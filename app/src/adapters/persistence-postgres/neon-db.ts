import { neon, NeonQueryFunction } from '@neondatabase/serverless';
import { getConfig } from '../../config';

let sql: NeonQueryFunction<false, false> | null = null;

/**
 * 获取 Neon SQL 客户端（serverless 模式，适合无服务器环境）n */
export function getNeonSql(): NeonQueryFunction<false, false> {
  if (sql) {
    return sql;
  }

  const connectionString = getConfig().database.url;
  if (!connectionString) {
    throw new Error('缺少 DATABASE_URL 环境变量，无法连接数据库');
  }

  sql = neon(connectionString);
  return sql;
}

/**
 * 重置 Neon SQL 客户端（用于测试或重新连接）
 */
export function resetNeonSql(): void {
  sql = null;
}
