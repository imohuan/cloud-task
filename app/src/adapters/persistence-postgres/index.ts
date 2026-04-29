import { getDbPool, closeDbPool, getPoolStatus, type DbPoolConfig } from '@adapters/persistence-postgres/db';
import { getNeonSql, resetNeonSql } from '@adapters/persistence-postgres/neon-db';
import { ensureDatabaseSchema } from '@adapters/persistence-postgres/schema';
import { PostgresAuthProfileRepository } from '@adapters/persistence-postgres/repositories/auth-profile.repository';
import { PostgresTaskRunRepository } from '@adapters/persistence-postgres/repositories/task-run.repository';
import type { Pool } from 'pg';

let pool: Pool | null = null;

/** 【优化】异步初始化连接池，支持重试机制 */
export async function initPersistence(config?: DbPoolConfig): Promise<void> {
  pool = await getDbPool(config);
  await ensureDatabaseSchema(pool);
}

/** 【优化】获取连接池实例（需在 initPersistence 之后调用） */
export function getPool(): Pool {
  if (!pool) {
    throw new Error('数据库尚未初始化，请先调用 initPersistence()');
  }
  return pool;
}

/** 【优化】延迟初始化仓储实例 */
export const getAuthProfileRepository = () => new PostgresAuthProfileRepository(getPool());
export const getTaskRunRepository = () => new PostgresTaskRunRepository(getPool());

export async function shutdownPersistence(): Promise<void> {
  await closeDbPool();
  resetNeonSql();
}

// 导出 Neon 支持
export { getNeonSql, resetNeonSql } from '@adapters/persistence-postgres/neon-db';

// 导出连接池状态
export { getPoolStatus } from '@adapters/persistence-postgres/db';

// 导出仓储类，允许使用自定义连接
export { PostgresAuthProfileRepository } from '@adapters/persistence-postgres/repositories/auth-profile.repository';
export { PostgresTaskRunRepository } from '@adapters/persistence-postgres/repositories/task-run.repository';
