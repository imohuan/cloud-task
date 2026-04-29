import { Database } from 'bun:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { Logger } from '../../utils/logger';
import { getConfig } from '../../config';

const logger = new Logger('SQLite');

let db: Database | null = null;
let isConnecting = false;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export interface SQLiteConfig {
  path?: string;
  busyTimeout?: number;
}

export async function getSQLiteDb(config?: SQLiteConfig): Promise<Database> {
  if (db) return db;

  if (isConnecting) {
    while (isConnecting) await sleep(50);
    if (db) return db;
  }

  isConnecting = true;
  try {
    const dbPath = config?.path ?? getConfig().database.sqlitePath!;
    const busyTimeout = config?.busyTimeout ?? 5000;

    mkdirSync(dirname(dbPath), { recursive: true });
    db = new Database(dbPath, { create: true });
    db.exec(`PRAGMA journal_mode = WAL;`);
    db.exec(`PRAGMA busy_timeout = ${busyTimeout};`);
    db.exec(`PRAGMA foreign_keys = ON;`);

    logger.info(`SQLite 已连接: ${dbPath}, WAL mode enabled`);
    return db;
  } catch (error) {
    logger.error('SQLite 连接失败', error);
    throw error;
  } finally {
    isConnecting = false;
  }
}

export function getDbStatus(): { path: string; inTransaction: boolean } | null {
  if (!db) return null;
  return {
    path: db.filename,
    inTransaction: db.inTransaction,
  };
}

export function closeSQLiteDb(): void {
  if (!db) return;
  db.close();
  db = null;
  logger.info('SQLite 连接已关闭');
}
