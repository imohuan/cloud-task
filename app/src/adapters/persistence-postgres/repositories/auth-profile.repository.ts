import type { Pool } from 'pg';
import type { AuthProfile } from '@core/contracts/auth.types';
import type { AuthProfileRepository } from '@core/ports/auth-profile.repository';

type AuthProfileRow = {
  id: string;
  platform_id: string;
  auth_strategy_id: string;
  name: string;
  credentials_json: Record<string, any>;
  enabled: boolean;
  created_at: string | Date;
  updated_at: string | Date;
};

function mapAuthProfile(row: AuthProfileRow): AuthProfile {
  return {
    id: row.id,
    platformId: row.platform_id,
    authStrategyId: row.auth_strategy_id,
    name: row.name,
    credentials: row.credentials_json ?? {},
    enabled: row.enabled,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export class PostgresAuthProfileRepository implements AuthProfileRepository {
  constructor(private readonly pool: Pool) {}

  async findAll(): Promise<AuthProfile[]> {
    const result = await this.pool.query<AuthProfileRow>(
      `
      SELECT id, platform_id, auth_strategy_id, name, credentials_json, enabled, created_at, updated_at
      FROM platform_auth_profiles
      ORDER BY created_at DESC
      `,
    );

    return result.rows.map(mapAuthProfile);
  }

  async findById(id: string): Promise<AuthProfile | null> {
    const result = await this.pool.query<AuthProfileRow>(
      `
      SELECT id, platform_id, auth_strategy_id, name, credentials_json, enabled, created_at, updated_at
      FROM platform_auth_profiles
      WHERE id = $1
      LIMIT 1
      `,
      [id],
    );

    const row = result.rows[0];
    return row ? mapAuthProfile(row) : null;
  }

  async findByPlatformId(platformId: string): Promise<AuthProfile[]> {
    const result = await this.pool.query<AuthProfileRow>(
      `
      SELECT id, platform_id, auth_strategy_id, name, credentials_json, enabled, created_at, updated_at
      FROM platform_auth_profiles
      WHERE platform_id = $1
      ORDER BY created_at DESC
      `,
      [platformId],
    );

    return result.rows.map(mapAuthProfile);
  }

  async findByName(name: string): Promise<AuthProfile | null> {
    const result = await this.pool.query<AuthProfileRow>(
      `
      SELECT id, platform_id, auth_strategy_id, name, credentials_json, enabled, created_at, updated_at
      FROM platform_auth_profiles
      WHERE name = $1
      LIMIT 1
      `,
      [name],
    );

    const row = result.rows[0];
    return row ? mapAuthProfile(row) : null;
  }

  async create(profile: Omit<AuthProfile, 'id' | 'createdAt' | 'updatedAt'>): Promise<AuthProfile> {
    const result = await this.pool.query<AuthProfileRow>(
      `
      INSERT INTO platform_auth_profiles (platform_id, auth_strategy_id, name, credentials_json, enabled)
      VALUES ($1, $2, $3, $4::jsonb, $5)
      RETURNING id, platform_id, auth_strategy_id, name, credentials_json, enabled, created_at, updated_at
      `,
      [
        profile.platformId,
        profile.authStrategyId,
        profile.name,
        JSON.stringify(profile.credentials ?? {}),
        profile.enabled,
      ],
    );

    return mapAuthProfile(result.rows[0]);
  }

  async update(id: string, profile: Partial<AuthProfile>): Promise<AuthProfile> {
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (profile.platformId !== undefined) {
      setClauses.push(`platform_id = $${paramIndex++}`);
      values.push(profile.platformId);
    }

    if (profile.authStrategyId !== undefined) {
      setClauses.push(`auth_strategy_id = $${paramIndex++}`);
      values.push(profile.authStrategyId);
    }

    if (profile.name !== undefined) {
      setClauses.push(`name = $${paramIndex++}`);
      values.push(profile.name);
    }

    if (profile.credentials !== undefined) {
      setClauses.push(`credentials_json = $${paramIndex++}::jsonb`);
      values.push(JSON.stringify(profile.credentials));
    }

    if (profile.enabled !== undefined) {
      setClauses.push(`enabled = $${paramIndex++}`);
      values.push(profile.enabled);
    }

    if (setClauses.length === 0) {
      throw new Error('没有要更新的字段');
    }

    setClauses.push('updated_at = NOW()');

    // id 是最后一个参数
    values.push(id);

    const result = await this.pool.query<AuthProfileRow>(
      `
      UPDATE platform_auth_profiles
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, platform_id, auth_strategy_id, name, credentials_json, enabled, created_at, updated_at
      `,
      values,
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error('认证配置不存在');
    }

    return mapAuthProfile(row);
  }

  async delete(id: string): Promise<void> {
    await this.pool.query('DELETE FROM platform_auth_profiles WHERE id = $1', [id]);
  }
}
