/**
 * PostgreSQL 连接池管理
 * 
 * 【问题分析】
 * 1. 连接池配置硬编码，无法灵活调整
 * 2. console 输出无法统一管理
 * 3. 缺少连接健康检查机制
 * 
 * 【优化方向】
 * - 使用 Logger 替代 console
 * - 支持配置注入
 * - 添加连接池状态监控
 * - 添加连接重试机制
 * - 增加连接超时时间以适应 Serverless 数据库
 */

import { Pool, PoolClient } from 'pg';
import { Logger } from '../../utils/logger';
import { getConfig } from '../../config';

let pool: Pool | null = null;
let isConnecting = false;
const logger = new Logger('PostgreSQL');

function buildSslConfig(connectionString: string) {
  if (!connectionString.includes('sslmode=')) {
    return undefined;
  }

  return {
    rejectUnauthorized: false,
  };
}

export interface DbPoolConfig {
  connectionString: string;
  poolSize?: number;
  idleTimeoutMs?: number;
  connectionTimeoutMs?: number;
  retryAttempts?: number;
  retryDelayMs?: number;
}

/** 延迟函数 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** 带重试的连接创建 */
async function createPoolWithRetry(
  poolConfig: any,
  maxRetries: number,
  retryDelayMs: number
): Promise<Pool> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const newPool = new Pool(poolConfig);
      
      // 测试连接
      const client = await newPool.connect();
      await client.query('SELECT 1');
      client.release();
      
      logger.info(`PostgreSQL 连接池创建成功 (尝试 ${attempt}/${maxRetries})`);
      return newPool;
    } catch (error) {
      logger.warn(`PostgreSQL 连接尝试 ${attempt}/${maxRetries} 失败`, { error: (error as Error).message });
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // 指数退避
      const delay = retryDelayMs * Math.pow(1.5, attempt - 1);
      logger.info(`等待 ${Math.round(delay)}ms 后重试...`);
      await sleep(delay);
    }
  }
  throw new Error('创建连接池失败：超过最大重试次数');
}

export async function getDbPool(config?: DbPoolConfig): Promise<Pool> {
  if (pool) {
    return pool;
  }

  // 防止并发创建
  if (isConnecting) {
    while (isConnecting) {
      await sleep(100);
    }
    if (pool) return pool;
  }

  isConnecting = true;

  try {
    const dbConfig = getConfig().database;
    const connectionString = config?.connectionString || dbConfig.url;
    if (!connectionString) {
      throw new Error('缺少 DATABASE_URL 环境变量，无法连接数据库');
    }

    // 使用传入配置或全局配置
    const max = config?.poolSize ?? dbConfig.poolSize;
    const idleTimeoutMillis = config?.idleTimeoutMs ?? dbConfig.idleTimeoutMs;
    /** 【优化】增加连接超时时间到 30 秒，适应 Serverless 数据库冷启动 */
    const connectionTimeoutMillis = config?.connectionTimeoutMs ?? dbConfig.connectionTimeoutMs;
    const retryAttempts = config?.retryAttempts ?? 3;
    const retryDelayMs = config?.retryDelayMs ?? 1000;

    const poolConfig = {
      connectionString,
      ssl: buildSslConfig(connectionString),
      // 连接池配置 - 防止 Neon 连接超时
      idleTimeoutMillis,
      connectionTimeoutMillis,
      max,
      keepAlive: true,
      /** 【优化】添加 keepAliveInitialDelay 保持连接活跃 */
      keepAliveInitialDelay: 10000,
    };

    pool = await createPoolWithRetry(poolConfig, retryAttempts, retryDelayMs);

    // 监听连接错误，自动重连
    pool.on('error', (err) => {
      logger.error('连接池错误', err);
      // 不退出进程，让连接池自动恢复
    });

    // 监听连接创建
    pool.on('connect', () => {
      logger.debug('新连接已创建到 PostgreSQL');
    });

    // 监听连接移除
    pool.on('remove', () => {
      logger.debug('连接已从 PostgreSQL 连接池移除');
    });

    logger.info(`PostgreSQL 连接池已创建 (max: ${max}, timeout: ${connectionTimeoutMillis}ms)`);

    return pool;
  } finally {
    isConnecting = false;
  }
}

/** 获取连接池状态 */
export function getPoolStatus(): { total: number; idle: number; waiting: number } | null {
  if (!pool) return null;
  return {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
  };
}

export async function closeDbPool(): Promise<void> {
  if (!pool) {
    return;
  }

  await pool.end();
  pool = null;
}
