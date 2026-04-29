import { getSQLiteDb, closeSQLiteDb, getDbStatus } from './db';
import { ensureDatabaseSchema } from './schema';
import { SqliteAuthProfileRepository } from './repositories/auth-profile.repository';
import { SqliteTaskRunRepository } from './repositories/task-run.repository';
import type { Database } from 'bun:sqlite';

let db: Database | null = null;

export async function initPersistence(): Promise<void> {
  const database = await getSQLiteDb();
  ensureDatabaseSchema(database);
  db = database;
}

export function getPool() {
  throw new Error('SQLite 不使用连接池，请使用 getDb() 获取 Database 实例');
}

export function getDb() {
  if (!db) {
    throw new Error('SQLite 尚未初始化，请先调用 initPersistence()');
  }
  return db;
}

export const getAuthProfileRepository = () => new SqliteAuthProfileRepository(getDb());
export const getTaskRunRepository = () => new SqliteTaskRunRepository(getDb());

export async function shutdownPersistence(): Promise<void> {
  closeSQLiteDb();
}

export { getDbStatus } from './db';
export { SqliteAuthProfileRepository } from './repositories/auth-profile.repository';
export { SqliteTaskRunRepository } from './repositories/task-run.repository';
