/**
 * 数据库 Schema 管理
 *
 * 【优化】
 * 1. 添加日志记录，便于追踪数据库初始化过程
 * 2. 添加错误处理
 * 3. 添加表存在性检测，避免每次启动都执行创建操作
 */

import type { Pool } from 'pg';
import { Logger } from '../../utils/logger';

const logger = new Logger('DatabaseSchema');

/**
 * 检查表是否已存在
 */
async function tableExists(pool: Pool, tableName: string): Promise<boolean> {
  const result = await pool.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = $1
    );
  `, [tableName]);
  return result.rows[0].exists;
}

/**
 * 检查索引是否已存在
 */
async function indexExists(pool: Pool, indexName: string): Promise<boolean> {
  const result = await pool.query(`
    SELECT EXISTS (
      SELECT FROM pg_indexes
      WHERE schemaname = 'public'
      AND indexname = $1
    );
  `, [indexName]);
  return result.rows[0].exists;
}

export async function ensureDatabaseSchema(pool: Pool): Promise<void> {
  const startTime = Date.now();
  logger.info('检查数据库 Schema 状态...');

  try {
    // 检查核心表是否已存在
    const authProfilesExists = await tableExists(pool, 'platform_auth_profiles');
    const taskRunsExists = await tableExists(pool, 'task_runs_v2');

    // 如果所有表都已存在，仍需检查是否有新增列需要迁移
    if (authProfilesExists && taskRunsExists) {
      // 检查是否需要添加 deleted 列
      const deletedCheck = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'task_runs_v2' AND column_name = 'deleted'
      `);

      if (deletedCheck.rows.length === 0) {
        logger.info('为 task_runs_v2 表添加 deleted 字段...');
        await pool.query(`ALTER TABLE task_runs_v2 ADD COLUMN deleted BOOLEAN NOT NULL DEFAULT false`);
        logger.info('deleted 字段添加完成');
      }

      logger.info('数据库 Schema 已存在，跳过初始化');
      return;
    }

    logger.info('开始初始化数据库 Schema...');

    // 创建扩展（幂等操作，无需检测）
    logger.debug('创建 pgcrypto 扩展...');
    await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');

    // 创建认证配置表
    if (!authProfilesExists) {
      logger.debug('创建 platform_auth_profiles 表...');
      await pool.query(`
        CREATE TABLE platform_auth_profiles (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          platform_id VARCHAR(100) NOT NULL,
          auth_strategy_id VARCHAR(100) NOT NULL,
          name VARCHAR(200) NOT NULL,
          credentials_json JSONB NOT NULL,
          enabled BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      // 创建索引
      logger.debug('创建 platform_auth_profiles 索引...');
      await pool.query(`
        CREATE INDEX idx_platform_auth_profiles_platform_id
          ON platform_auth_profiles(platform_id);
      `);

      // 创建名称唯一索引（先尝试清理重复数据，再创建索引）
      try {
        logger.debug('创建名称唯一索引...');
        await pool.query(`
          CREATE UNIQUE INDEX idx_platform_auth_profiles_name_unique
            ON platform_auth_profiles(name);
        `);
      } catch (err: any) {
        logger.warn('创建名称唯一索引失败:', err.message);
      }
    }

    // 创建任务运行表
    if (!taskRunsExists) {
      logger.debug('创建 task_runs_v2 表...');
      await pool.query(`
        CREATE TABLE task_runs_v2 (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          api_id VARCHAR(200) NOT NULL,
          auth_profile_id UUID NOT NULL REFERENCES platform_auth_profiles(id) ON DELETE RESTRICT,
          status VARCHAR(50) NOT NULL,
          input_payload JSONB NOT NULL,
          output_payload JSONB,
          error_payload JSONB,
          progress INTEGER,
          retry_count INTEGER NOT NULL DEFAULT 0,
          -- 执行主机信息（用于区分多环境）
          worker_info JSONB,
          -- API 调用日志（每次第三方请求/响应的完整记录，JSONB 数组）
          api_call_logs JSONB NOT NULL DEFAULT '[]',
          -- 下次轮询时间（仅 polling 状态有效）
          next_poll_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          started_at TIMESTAMPTZ,
          completed_at TIMESTAMPTZ,
          deleted BOOLEAN NOT NULL DEFAULT false
        );
      `);

      // 创建任务表索引
      logger.debug('创建 task_runs_v2 索引...');
      await pool.query(`CREATE INDEX idx_task_runs_v2_status ON task_runs_v2(status);`);
      await pool.query(`CREATE INDEX idx_task_runs_v2_created_at ON task_runs_v2(created_at DESC);`);
      await pool.query(`CREATE INDEX idx_task_runs_v2_api_id ON task_runs_v2(api_id);`);
      await pool.query(`CREATE INDEX idx_task_runs_polling ON task_runs_v2(status, next_poll_at) WHERE status = 'polling';`);
    } else {
      // 检查是否需要添加 worker_info 列（已存在的表）
      logger.debug('检查 task_runs_v2 表是否需要添加 worker_info 字段...');
      const workerInfoCheck = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'task_runs_v2' AND column_name = 'worker_info'
      `);

      if (workerInfoCheck.rows.length === 0) {
        logger.info('为 task_runs_v2 表添加 worker_info 字段...');
        await pool.query(`ALTER TABLE task_runs_v2 ADD COLUMN worker_info JSONB`);
        logger.info('worker_info 字段添加完成');
      }

      // 检查是否需要添加 api_call_logs 列（已存在的表）
      logger.debug('检查 task_runs_v2 表是否需要添加 api_call_logs 字段...');
      const apiCallLogsCheck = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'task_runs_v2' AND column_name = 'api_call_logs'
      `);

      if (apiCallLogsCheck.rows.length === 0) {
        logger.info('为 task_runs_v2 表添加 api_call_logs 字段...');
        await pool.query(`ALTER TABLE task_runs_v2 ADD COLUMN api_call_logs JSONB NOT NULL DEFAULT '[]'`);
        logger.info('api_call_logs 字段添加完成');
      }

      // 检查是否需要添加 next_poll_at 列
      logger.debug('检查 task_runs_v2 表是否需要添加 next_poll_at 字段...');
      const nextPollAtCheck = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'task_runs_v2' AND column_name = 'next_poll_at'
      `);

      if (nextPollAtCheck.rows.length === 0) {
        logger.info('为 task_runs_v2 表添加 next_poll_at 字段...');
        await pool.query(`ALTER TABLE task_runs_v2 ADD COLUMN next_poll_at TIMESTAMPTZ`);
        await pool.query(`CREATE INDEX idx_task_runs_polling ON task_runs_v2(status, next_poll_at) WHERE status = 'polling';`);
        logger.info('next_poll_at 字段添加完成');
      }

      // 检查是否需要添加 deleted 列
      logger.debug('检查 task_runs_v2 表是否需要添加 deleted 字段...');
      const deletedCheck = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'task_runs_v2' AND column_name = 'deleted'
      `);

      if (deletedCheck.rows.length === 0) {
        logger.info('为 task_runs_v2 表添加 deleted 字段...');
        await pool.query(`ALTER TABLE task_runs_v2 ADD COLUMN deleted BOOLEAN NOT NULL DEFAULT false`);
        logger.info('deleted 字段添加完成');
      }
    }

    const duration = Date.now() - startTime;
    logger.info(`数据库 Schema 初始化完成，耗时: ${duration}ms`);
  } catch (error) {
    logger.error('数据库 Schema 初始化失败', error);
    throw error;
  }
}
