/**
 * 配置管理模块
 * 
 * 【设计原则】
 * 1. 集中管理所有环境变量，避免散落在代码各处
 * 2. 启动时验证配置，提前发现配置错误
 * 3. 提供类型安全的配置访问
 * 4. 支持不同环境的默认配置
 * 
 * 【高可用优化】
 * - 配置值解析时提供默认值，避免 undefined 导致的问题
 * - 敏感信息（如密码）可以在这里进行脱敏处理
 * - 支持配置热更新（未来扩展）
 */

import { LoggerOptions } from '@/utils/logger';
import { getAppRoot } from '@/utils/app-root';
import { join } from 'path';

/** 服务器配置 */
export interface ServerConfig {
  port: number;
  shutdownTimeoutMs: number;
  requestTimeoutMs: number;
}

/** 数据库配置 */
export interface DatabaseConfig {
  url: string;
  poolSize: number;
  idleTimeoutMs: number;
  connectionTimeoutMs: number;
  ssl?: {
    rejectUnauthorized: boolean;
  };
  /** SQLite 数据库文件路径（仅 sqlite 驱动使用） */
  sqlitePath?: string;
}

/** Worker 配置 */
export interface WorkerConfig {
  enabled: boolean;
  concurrency: number;
  pollIntervalMs: number;
  maxAttempts: number;
  processingTimeoutSec: number;
  /** 是否启用指数退避重试 */
  enableExponentialBackoff: boolean;
  /** 最大退避延迟（毫秒） */
  maxBackoffMs: number;
}

/** 日志配置 */
export interface LogConfig extends LoggerOptions {
  logDir: string;
}

/** 任务队列配置 */
export interface QueueConfig {
  driver: 'postgres' | 'sqlite';
}

/** 应用完整配置 */
export interface AppConfig {
  env: 'development' | 'production' | 'test';
  server: ServerConfig;
  database: DatabaseConfig;
  worker: WorkerConfig;
  queue: QueueConfig;
  log: LogConfig;
}

/** 解析数值，提供默认值和范围限制 */
function parseIntEnv(value: string | undefined, defaultValue: number, min?: number, max?: number): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) return defaultValue;
  if (min !== undefined && parsed < min) return min;
  if (max !== undefined && parsed > max) return max;
  return parsed;
}

/** 加载配置 */
export function loadConfig(): AppConfig {
  const env = (process.env.NODE_ENV as AppConfig['env']) || 'development';

  return {
    /** 运行环境：development(开发) | production(生产) | test(测试) */
    env,
    server: {
      /** 服务器监听端口，默认 3000，范围 1-65535 */
      port: parseIntEnv(process.env.PORT, 3000, 1, 65535),
      /** 优雅关闭超时时间(毫秒)，默认 30 秒 */
      shutdownTimeoutMs: parseIntEnv(process.env.SHUTDOWN_TIMEOUT_MS, 30000),
      /** HTTP 请求超时时间(毫秒)，默认 60 秒 */
      requestTimeoutMs: parseIntEnv(process.env.REQUEST_TIMEOUT_MS, 60 * 1000),
    },
    database: {
      /** 数据库连接 URL，必需配置（Postgres） */
      url: process.env.DATABASE_URL || '',
      /** SQLite 数据库文件路径 */
      sqlitePath: process.env.SQLITE_DB_PATH || join(getAppRoot(), 'data', 'store', 'app.db'),
      /** 连接池大小，默认 10，范围 1-100 */
      poolSize: parseIntEnv(process.env.DB_POOL_SIZE, 10, 1, 100),
      /** 连接空闲超时时间(毫秒)，默认 30 秒 */
      idleTimeoutMs: parseIntEnv(process.env.DB_IDLE_TIMEOUT_MS, 30000),
      /** 连接建立超时时间(毫秒)，默认 10 秒 */
      connectionTimeoutMs: parseIntEnv(process.env.DB_CONNECTION_TIMEOUT_MS, 10000),
      /** SSL 配置：当 URL 包含 sslmode 时启用，生产环境建议开启 */
      ssl: process.env.DATABASE_URL?.includes('sslmode=')
        ? { rejectUnauthorized: false }
        : undefined,
    },
    worker: {
      /** 是否启用任务处理器，默认 true */
      enabled: process.env.ENABLE_WORKER !== 'false',
      /** 并发处理任务数，默认 3，范围 1-50 */
      concurrency: parseIntEnv(process.env.WORKER_CONCURRENCY, 3, 1, 50),
      /** 轮询新任务的间隔(毫秒)，默认 1 秒，最小 100ms */
      pollIntervalMs: parseIntEnv(process.env.WORKER_POLL_INTERVAL, 1000, 100),
      /** 任务最大重试次数，默认 3，范围 1-10 */
      maxAttempts: parseIntEnv(process.env.TASK_MAX_ATTEMPTS, 3, 1, 10),
      /** 单个任务处理超时时间(秒)，默认 半小时，最小 10 秒 */
      processingTimeoutSec: parseIntEnv(process.env.TASK_PROCESSING_TIMEOUT_SEC, 60 * 30, 10),
      /** 是否启用指数退避重试策略，默认 true */
      enableExponentialBackoff: process.env.WORKER_ENABLE_BACKOFF !== 'false',
      /** 最大退避延迟(毫秒)，默认 60 秒，最小 1 秒 */
      maxBackoffMs: parseIntEnv(process.env.WORKER_MAX_BACKOFF_MS, 60000, 1000),
    },
    queue: {
      /** 任务队列驱动：postgres 或 sqlite，默认 postgres */
      driver: (process.env.TASK_QUEUE_DRIVER as QueueConfig['driver']) || 'postgres',
    },
    log: {
      /** 日志级别：debug | info | warn | error，生产环境默认 info，其他默认 debug */
      level: (process.env.LOG_LEVEL as LogConfig['level']) || (env === 'production' ? 'info' : 'debug'),
      /** 是否输出到控制台，默认 true */
      enableConsole: process.env.LOG_ENABLE_CONSOLE !== 'false',
      /** 是否写入日志文件，默认 false */
      enableFile: process.env.LOG_ENABLE_FILE === 'true',
      /** 日志文件存放目录，未指定则使用默认路径 */
      logDir: process.env.LOG_DIR || join(getAppRoot(), 'logs'),
    },
  };
}

/** 验证配置 */
export function validateConfig(config: AppConfig): void {
  const errors: string[] = [];

  // 验证数据库 URL（SQLite 模式下可选）
  if (config.queue.driver === 'postgres' && !config.database.url) {
    errors.push('DATABASE_URL 是必需的（当前使用 postgres 驱动）');
  }
  if (config.database.url) {
    // 简单的 URL 格式验证
    try {
      new URL(config.database.url);
    } catch {
      errors.push('DATABASE_URL 格式无效');
    }
  }

  // 验证数值范围
  if (config.server.port < 1 || config.server.port > 65535) {
    errors.push('PORT 必须在 1-65535 范围内');
  }

  if (config.worker.concurrency < 1) {
    errors.push('WORKER_CONCURRENCY 必须大于 0');
  }

  if (config.worker.pollIntervalMs < 100) {
    errors.push('WORKER_POLL_INTERVAL 不能小于 100ms');
  }

  if (errors.length > 0) {
    throw new Error(`配置验证失败:\n${errors.map(e => `  - ${e}`).join('\n')}`);
  }
}

/** 获取配置实例（单例） */
let configInstance: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (!configInstance) {
    configInstance = loadConfig();
  }
  return configInstance;
}


/** 重置配置（用于测试） */
export function resetConfig(): void {
  configInstance = null;
}
