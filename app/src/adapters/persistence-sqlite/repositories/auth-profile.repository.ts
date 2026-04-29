import type { Database } from 'bun:sqlite';
import type { AuthProfile } from '@core/contracts/auth.types';
import type { AuthProfileRepository } from '@core/ports/auth-profile.repository';
import { randomUUID } from 'crypto';

type AuthProfileRow = {
  id: string;
  platform_id: string;
  auth_strategy_id: string;
  name: string;
  credentials_json: string;
  enabled: number;
  created_at: string;
  updated_at: string;
};

function mapAuthProfile(row: AuthProfileRow): AuthProfile {
  return {
    id: row.id,
    platformId: row.platform_id,
    authStrategyId: row.auth_strategy_id,
    name: row.name,
    credentials: JSON.parse(row.credentials_json || '{}'),
    enabled: row.enabled === 1,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export class SqliteAuthProfileRepository implements AuthProfileRepository {
  constructor(private readonly db: Database) {}

  async findAll(): Promise<AuthProfile[]> {
    const stmt = this.db.prepare(
      `SELECT id, platform_id, auth_strategy_id, name, credentials_json, enabled, created_at, updated_at
       FROM platform_auth_profiles
       ORDER BY created_at DESC`
    );
    const rows = stmt.all() as AuthProfileRow[];
    stmt.finalize();
    return rows.map(mapAuthProfile);
  }

  async findById(id: string): Promise<AuthProfile | null> {
    const stmt = this.db.prepare(
      `SELECT id, platform_id, auth_strategy_id, name, credentials_json, enabled, created_at, updated_at
       FROM platform_auth_profiles
       WHERE id = ?1
       LIMIT 1`
    );
    const row = stmt.get(id) as AuthProfileRow | undefined;
    stmt.finalize();
    return row ? mapAuthProfile(row) : null;
  }

  async findByPlatformId(platformId: string): Promise<AuthProfile[]> {
    const stmt = this.db.prepare(
      `SELECT id, platform_id, auth_strategy_id, name, credentials_json, enabled, created_at, updated_at
       FROM platform_auth_profiles
       WHERE platform_id = ?1
       ORDER BY created_at DESC`
    );
    const rows = stmt.all(platformId) as AuthProfileRow[];
    stmt.finalize();
    return rows.map(mapAuthProfile);
  }

  async findByName(name: string): Promise<AuthProfile | null> {
    const stmt = this.db.prepare(
      `SELECT id, platform_id, auth_strategy_id, name, credentials_json, enabled, created_at, updated_at
       FROM platform_auth_profiles
       WHERE name = ?1
       LIMIT 1`
    );
    const row = stmt.get(name) as AuthProfileRow | undefined;
    stmt.finalize();
    return row ? mapAuthProfile(row) : null;
  }

  async create(profile: Omit<AuthProfile, 'id' | 'createdAt' | 'updatedAt'>): Promise<AuthProfile> {
    const id = randomUUID();
    const stmt = this.db.prepare(
      `INSERT INTO platform_auth_profiles (id, platform_id, auth_strategy_id, name, credentials_json, enabled)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)
       RETURNING id, platform_id, auth_strategy_id, name, credentials_json, enabled, created_at, updated_at`
    );
    const row = stmt.get(
      id,
      profile.platformId,
      profile.authStrategyId,
      profile.name,
      JSON.stringify(profile.credentials ?? {}),
      profile.enabled ? 1 : 0,
    ) as AuthProfileRow;
    stmt.finalize();
    return mapAuthProfile(row);
  }

  async update(id: string, profile: Partial<AuthProfile>): Promise<AuthProfile> {
    const setClauses: string[] = [];
    const values: unknown[] = [];

    if (profile.platformId !== undefined) {
      setClauses.push(`platform_id = ?${values.length + 1}`);
      values.push(profile.platformId);
    }
    if (profile.authStrategyId !== undefined) {
      setClauses.push(`auth_strategy_id = ?${values.length + 1}`);
      values.push(profile.authStrategyId);
    }
    if (profile.name !== undefined) {
      setClauses.push(`name = ?${values.length + 1}`);
      values.push(profile.name);
    }
    if (profile.credentials !== undefined) {
      setClauses.push(`credentials_json = ?${values.length + 1}`);
      values.push(JSON.stringify(profile.credentials));
    }
    if (profile.enabled !== undefined) {
      setClauses.push(`enabled = ?${values.length + 1}`);
      values.push(profile.enabled ? 1 : 0);
    }

    if (setClauses.length === 0) {
      throw new Error('没有要更新的字段');
    }

    setClauses.push(`updated_at = datetime('now')`);
    values.push(id);

    const stmt = this.db.prepare(
      `UPDATE platform_auth_profiles
       SET ${setClauses.join(', ')}
       WHERE id = ?${values.length}
       RETURNING id, platform_id, auth_strategy_id, name, credentials_json, enabled, created_at, updated_at`
    );
    const row = stmt.get(...values) as AuthProfileRow | undefined;
    stmt.finalize();

    if (!row) {
      throw new Error('认证配置不存在');
    }
    return mapAuthProfile(row);
  }

  async delete(id: string): Promise<void> {
    const stmt = this.db.prepare(`DELETE FROM platform_auth_profiles WHERE id = ?1`);
    stmt.run(id);
    stmt.finalize();
  }
}
