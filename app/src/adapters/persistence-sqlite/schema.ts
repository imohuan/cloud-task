import type { Database } from 'bun:sqlite';
import { Logger } from '../../utils/logger';

const logger = new Logger('SQLiteSchema');

function tableExists(db: Database, tableName: string): boolean {
  const stmt = db.prepare(
    `SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?`
  );
  const row = stmt.get(tableName);
  stmt.finalize();
  return !!row;
}

function indexExists(db: Database, indexName: string): boolean {
  const stmt = db.prepare(
    `SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = ?`
  );
  const row = stmt.get(indexName);
  stmt.finalize();
  return !!row;
}

export function ensureDatabaseSchema(db: Database): void {
  const startTime = Date.now();
  logger.info('检查 SQLite Schema 状态...');

  try {
    const authProfilesExists = tableExists(db, 'platform_auth_profiles');
    const taskRunsExists = tableExists(db, 'task_runs_v2');

    if (authProfilesExists && taskRunsExists) {
      // 表已存在，但仍需检查是否有新增列需要迁移
      const columns = db.prepare(`PRAGMA table_info(task_runs_v2);`).all() as Array<{ name: string }>;
      const columnNames = new Set(columns.map(c => c.name));

      if (!columnNames.has('deleted')) {
        logger.info('为 task_runs_v2 添加 deleted 字段...');
        db.exec(`ALTER TABLE task_runs_v2 ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0;`);
      }

      logger.info('SQLite Schema 已存在，跳过初始化');
      return;
    }

    logger.info('开始初始化 SQLite Schema...');

    db.exec(`BEGIN;`);

    try {
      if (!authProfilesExists) {
        logger.debug('创建 platform_auth_profiles 表...');
        db.exec(`
          CREATE TABLE platform_auth_profiles (
            id TEXT PRIMARY KEY,
            platform_id TEXT NOT NULL,
            auth_strategy_id TEXT NOT NULL,
            name TEXT NOT NULL,
            credentials_json TEXT NOT NULL DEFAULT '{}',
            enabled INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
          );
        `);

        db.exec(`
          CREATE INDEX idx_platform_auth_profiles_platform_id
            ON platform_auth_profiles(platform_id);
        `);

        db.exec(`
          CREATE UNIQUE INDEX idx_platform_auth_profiles_name_unique
            ON platform_auth_profiles(name);
        `);
      }

      if (!taskRunsExists) {
        logger.debug('创建 task_runs_v2 表...');
        db.exec(`
          CREATE TABLE task_runs_v2 (
            id TEXT PRIMARY KEY,
            api_id TEXT NOT NULL,
            auth_profile_id TEXT NOT NULL,
            status TEXT NOT NULL,
            input_payload TEXT NOT NULL DEFAULT '{}',
            output_payload TEXT,
            error_payload TEXT,
            progress INTEGER,
            retry_count INTEGER NOT NULL DEFAULT 0,
            worker_info TEXT,
            api_call_logs TEXT NOT NULL DEFAULT '[]',
            next_poll_at INTEGER,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            started_at TEXT,
            completed_at TEXT,
            deleted INTEGER NOT NULL DEFAULT 0
          );
        `);

        db.exec(`CREATE INDEX idx_task_runs_v2_status ON task_runs_v2(status);`);
        db.exec(`CREATE INDEX idx_task_runs_v2_created_at ON task_runs_v2(created_at DESC);`);
        db.exec(`CREATE INDEX idx_task_runs_v2_api_id ON task_runs_v2(api_id);`);
        db.exec(`CREATE INDEX idx_task_runs_polling ON task_runs_v2(status, next_poll_at) WHERE status = 'polling';`);
      }

      // 检查并迁移缺失列（后续扩展用）
      const columns = db.prepare(`PRAGMA table_info(task_runs_v2);`).all() as Array<{ name: string }>;
      const columnNames = new Set(columns.map(c => c.name));

      if (!columnNames.has('worker_info')) {
        logger.info('为 task_runs_v2 添加 worker_info 字段...');
        db.exec(`ALTER TABLE task_runs_v2 ADD COLUMN worker_info TEXT;`);
      }

      if (!columnNames.has('api_call_logs')) {
        logger.info('为 task_runs_v2 添加 api_call_logs 字段...');
        db.exec(`ALTER TABLE task_runs_v2 ADD COLUMN api_call_logs TEXT NOT NULL DEFAULT '[]';`);
      }

      if (!columnNames.has('next_poll_at')) {
        logger.info('为 task_runs_v2 添加 next_poll_at 字段...');
        db.exec(`ALTER TABLE task_runs_v2 ADD COLUMN next_poll_at INTEGER;`);
        db.exec(`CREATE INDEX idx_task_runs_polling ON task_runs_v2(status, next_poll_at) WHERE status = 'polling';`);
      }

      if (!columnNames.has('deleted')) {
        logger.info('为 task_runs_v2 添加 deleted 字段...');
        db.exec(`ALTER TABLE task_runs_v2 ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0;`);
      }

      db.exec(`COMMIT;`);
    } catch (error) {
      db.exec(`ROLLBACK;`);
      throw error;
    }

    const duration = Date.now() - startTime;
    logger.info(`SQLite Schema 初始化完成，耗时: ${duration}ms`);
  } catch (error) {
    logger.error('SQLite Schema 初始化失败', error);
    throw error;
  }
}
