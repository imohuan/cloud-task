/**
 * PostgreSQL 任务运行仓储实现
 * 
 * 【优化】
 * 1. 添加日志记录，便于问题排查
 * 2. 添加查询耗时统计
 * 3. 添加错误处理和重试机制
 */

import type { Pool } from 'pg';
import type { TaskRun, TaskRunRepository, TaskStatus, ApiCallLog, QueueTask } from '@core/ports/task-run.repository';
import { Logger } from '../../../utils/logger';

const logger = new Logger('TaskRunRepository');

type TaskRunRow = {
  id: string;
  api_id: string;
  auth_profile_id: string;
  status: TaskStatus;
  input_payload: Record<string, any>;
  output_payload: Record<string, any> | null;
  error_payload: { code: string; message: string; details?: any } | null;
  progress: number | null;
  retry_count: number;
  worker_info: {
    hostname: string;
    pid: number;
    platform: string;
    arch: string;
    nodeVersion: string;
    env: string;
  } | null;
  api_call_logs: ApiCallLog[] | null;
  next_poll_at: string | Date | null;
  created_at: string | Date;
  started_at: string | Date | null;
  completed_at: string | Date | null;
  deleted: boolean | null;
};

function mapTaskRun(row: TaskRunRow): TaskRun {
  return {
    id: row.id,
    apiId: row.api_id,
    authProfileId: row.auth_profile_id,
    status: row.status,
    input: row.input_payload ?? {},
    output: row.output_payload ?? undefined,
    error: row.error_payload ?? undefined,
    progress: row.progress ?? undefined,
    workerInfo: row.worker_info ?? undefined,
    apiCallLogs: row.api_call_logs ?? [],
    createdAt: new Date(row.created_at),
    startedAt: row.started_at ? new Date(row.started_at) : undefined,
    completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
    retryCount: row.retry_count,
    deleted: row.deleted ?? false,
  };
}

export class PostgresTaskRunRepository implements TaskRunRepository {
  constructor(private readonly pool: Pool) {}

  async findById(id: string): Promise<TaskRun | null> {
    const startTime = Date.now();
    logger.debug(`查询任务: ${id}`);

    try {
      const result = await this.pool.query<TaskRunRow>(
        `
        SELECT id, api_id, auth_profile_id, status, input_payload, output_payload, error_payload,
               progress, retry_count, worker_info, api_call_logs, next_poll_at, created_at, started_at, completed_at, deleted
        FROM task_runs_v2
        WHERE id = $1 AND (deleted = false OR deleted IS NULL)
        LIMIT 1
        `,
        [id],
      );

      const row = result.rows[0];
      const duration = Date.now() - startTime;
      
      if (row) {
        logger.debug(`查询任务成功: ${id}, 耗时: ${duration}ms`);
      } else {
        logger.debug(`任务不存在: ${id}, 耗时: ${duration}ms`);
      }
      
      return row ? mapTaskRun(row) : null;
    } catch (error) {
      logger.error(`查询任务失败: ${id}`, error);
      throw error;
    }
  }

  async create(task: Omit<TaskRun, 'id' | 'createdAt' | 'retryCount'>): Promise<TaskRun> {
    const startTime = Date.now();
    logger.debug(`创建任务: apiId=${task.apiId}`);

    try {
      const result = await this.pool.query<TaskRunRow>(
        `
        INSERT INTO task_runs_v2 (
          api_id,
          auth_profile_id,
          status,
          input_payload,
          output_payload,
          error_payload,
          progress,
          started_at,
          completed_at,
          api_call_logs
        )
        VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7, $8, $9, $10::jsonb)
        RETURNING id, api_id, auth_profile_id, status, input_payload, output_payload, error_payload,
                  progress, retry_count, worker_info, api_call_logs, next_poll_at, created_at, started_at, completed_at, deleted
        `,
        [
          task.apiId,
          task.authProfileId,
          task.status,
          JSON.stringify(task.input ?? {}),
          task.output ? JSON.stringify(task.output) : null,
          task.error ? JSON.stringify(task.error) : null,
          task.progress ?? null,
          task.startedAt ?? null,
          task.completedAt ?? null,
          JSON.stringify(task.apiCallLogs ?? []),
        ],
      );

      const created = mapTaskRun(result.rows[0]);
      const duration = Date.now() - startTime;
      logger.info(`任务创建成功: ${created.id}, 耗时: ${duration}ms`);
      
      return created;
    } catch (error) {
      logger.error(`任务创建失败: apiId=${task.apiId}`, error);
      throw error;
    }
  }

  async updateStatus(
    id: string,
    status: TaskStatus,
    updates?: Partial<Pick<TaskRun, 'output' | 'error' | 'progress' | 'completedAt' | 'startedAt' | 'workerInfo' | 'apiCallLogs'>> & { nextPollAt?: Date },
  ): Promise<TaskRun> {
    logger.debug(`更新任务状态: ${id} -> ${status}`);

    try {
      const result = await this.pool.query<TaskRunRow>(
        `
        UPDATE task_runs_v2
        SET status = $1,
            output_payload = COALESCE($2::jsonb, output_payload),
            error_payload = COALESCE($3::jsonb, error_payload),
            progress = COALESCE($4, progress),
            completed_at = COALESCE($5, completed_at),
            started_at = COALESCE($6, started_at),
            worker_info = COALESCE($7::jsonb, worker_info),
            api_call_logs = COALESCE($8::jsonb, api_call_logs),
            next_poll_at = COALESCE($9, next_poll_at)
        WHERE id = $10
        RETURNING id, api_id, auth_profile_id, status, input_payload, output_payload, error_payload,
                  progress, retry_count, worker_info, api_call_logs, next_poll_at, created_at, started_at, completed_at, deleted
        `,
        [
          status,
          updates?.output ? JSON.stringify(updates.output) : null,
          updates?.error ? JSON.stringify(updates.error) : null,
          updates?.progress ?? null,
          updates?.completedAt ?? null,
          updates?.startedAt ?? null,
          updates?.workerInfo ? JSON.stringify(updates.workerInfo) : null,
          updates?.apiCallLogs ? JSON.stringify(updates.apiCallLogs) : null,
          updates?.nextPollAt ?? null,
          id,
        ],
      );

      const row = result.rows[0];
      if (!row) {
        logger.error(`更新任务状态失败: 任务不存在 ${id}`);
        throw new Error('任务不存在');
      }

      logger.debug(`任务状态更新成功: ${id} -> ${status}`);
      return mapTaskRun(row);
    } catch (error) {
      logger.error(`更新任务状态失败: ${id}`, error);
      throw error;
    }
  }

  async getPendingTasks(limit = 20): Promise<TaskRun[]> {
    const startTime = Date.now();

    try {
      const result = await this.pool.query<TaskRunRow>(
        `
        SELECT id, api_id, auth_profile_id, status, input_payload, output_payload, error_payload,
               progress, retry_count, worker_info, api_call_logs, next_poll_at, created_at, started_at, completed_at, deleted
        FROM task_runs_v2
        WHERE status = 'pending' AND (deleted = false OR deleted IS NULL)
        ORDER BY created_at ASC
        LIMIT $1
        `,
        [limit],
      );

      const duration = Date.now() - startTime;
      logger.debug(`获取待处理任务: ${result.rows.length} 个, 耗时: ${duration}ms`);
      
      return result.rows.map(mapTaskRun);
    } catch (error) {
      logger.error('获取待处理任务失败', error);
      throw error;
    }
  }

  async findByIds(ids: string[]): Promise<TaskRun[]> {
    if (ids.length === 0) return [];
    const startTime = Date.now();

    try {
      const result = await this.pool.query<TaskRunRow>(
        `
        SELECT id, api_id, auth_profile_id, status, input_payload, output_payload, error_payload,
               progress, retry_count, worker_info, api_call_logs, next_poll_at, created_at, started_at, completed_at, deleted
        FROM task_runs_v2
        WHERE id = ANY($1) AND (deleted = false OR deleted IS NULL)
        `,
        [ids],
      );

      const duration = Date.now() - startTime;
      logger.debug(`批量查询任务: ${result.rows.length}/${ids.length} 个, 耗时: ${duration}ms`);
      return result.rows.map(mapTaskRun);
    } catch (error) {
      logger.error('批量查询任务失败', error);
      throw error;
    }
  }

  async queryTasks(filters: {
    status?: TaskStatus;
    search?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ tasks: TaskRun[]; total: number; page: number; pageSize: number }> {
    const startTime = Date.now();
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 20));
    const offset = (page - 1) * pageSize;

    const conditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (filters.status) {
      conditions.push(`status = $${paramIndex++}`);
      values.push(filters.status);
    }
    // 默认排除已删除的任务
    conditions.push(`(deleted = false OR deleted IS NULL)`);
    if (filters.search) {
      conditions.push(`(id ILIKE $${paramIndex++} OR api_id ILIKE $${paramIndex++})`);
      values.push(`%${filters.search}%`, `%${filters.search}%`);
    }
    if (filters.startDate) {
      conditions.push(`created_at >= $${paramIndex++}`);
      values.push(new Date(filters.startDate));
    }
    if (filters.endDate) {
      conditions.push(`created_at <= $${paramIndex++}`);
      const end = new Date(filters.endDate);
      end.setHours(23, 59, 59, 999);
      values.push(end);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    try {
      // 查询总数
      const countResult = await this.pool.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM task_runs_v2 ${whereClause}`,
        values,
      );
      const total = parseInt(countResult.rows[0].count, 10);

      // 查询分页数据
      const dataResult = await this.pool.query<TaskRunRow>(
        `
        SELECT id, api_id, auth_profile_id, status, input_payload, output_payload, error_payload,
               progress, retry_count, worker_info, api_call_logs, next_poll_at, created_at, started_at, completed_at, deleted
        FROM task_runs_v2
        ${whereClause}
        ORDER BY created_at ASC
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
        `,
        [...values, pageSize, offset],
      );

      const duration = Date.now() - startTime;
      logger.debug(`分页查询任务: ${dataResult.rows.length} 个, total=${total}, page=${page}, 耗时: ${duration}ms`);

      return {
        tasks: dataResult.rows.map(mapTaskRun),
        total,
        page,
        pageSize,
      };
    } catch (error) {
      logger.error('分页查询任务失败', error);
      throw error;
    }
  }

  async getRecentTasks(limit = 50): Promise<TaskRun[]> {
    const startTime = Date.now();
    
    try {
      // 先查询状态分布
      const statusResult = await this.pool.query<{ status: string; count: string }>(
        `SELECT status, COUNT(*) as count FROM task_runs_v2 GROUP BY status`
      );
      const statusCounts = statusResult.rows.map(r => `${r.status}=${r.count}`).join(', ');
      
      const result = await this.pool.query<TaskRunRow>(
        `
        SELECT id, api_id, auth_profile_id, status, input_payload, output_payload, error_payload,
               progress, retry_count, worker_info, api_call_logs, next_poll_at, created_at, started_at, completed_at, deleted
        FROM task_runs_v2
        WHERE (deleted = false OR deleted IS NULL)
        ORDER BY created_at DESC
        LIMIT $1
        `,
        [limit],
      );

      const duration = Date.now() - startTime;
      logger.debug(`获取最近任务: ${result.rows.length} 个 (状态分布: ${statusCounts}), 耗时: ${duration}ms`);
      
      return result.rows.map(mapTaskRun);
    } catch (error) {
      logger.error('获取最近任务失败', error);
      throw error;
    }
  }

  async incrementRetryCount(id: string): Promise<void> {
    try {
      await this.pool.query(
        `
        UPDATE task_runs_v2
        SET retry_count = retry_count + 1
        WHERE id = $1
        `,
        [id],
      );
      logger.debug(`增加重试次数: ${id}`);
    } catch (error) {
      logger.error(`增加重试次数失败: ${id}`, error);
      throw error;
    }
  }

  async claimNextTask(workerInfo: Record<string, any>): Promise<QueueTask | null> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query<{
        id: string;
        api_id: string;
        auth_profile_id: string;
        input_payload: Record<string, any>;
        retry_count: number;
      }>(
        `
        UPDATE task_runs_v2
        SET status = CASE WHEN task_runs_v2.status = 'polling' THEN 'polling-run' ELSE 'running' END,
            started_at = CASE WHEN task_runs_v2.status = 'pending' THEN NOW() ELSE task_runs_v2.started_at END,
            progress = CASE WHEN progress IS NULL OR progress < 5 THEN 5 ELSE progress END,
            worker_info = $1::jsonb
        FROM (
          SELECT id
          FROM task_runs_v2
          WHERE (status = 'pending'
             OR (status = 'polling' AND next_poll_at IS NOT NULL AND next_poll_at <= NOW()))
            AND (deleted = false OR deleted IS NULL)
          ORDER BY
            CASE WHEN status = 'pending' THEN 0 ELSE 1 END,
            created_at ASC
          FOR UPDATE SKIP LOCKED
          LIMIT 1
        ) t
        WHERE task_runs_v2.id = t.id
        RETURNING task_runs_v2.id, task_runs_v2.api_id, task_runs_v2.auth_profile_id,
                  task_runs_v2.input_payload, task_runs_v2.retry_count
        `,
        [JSON.stringify(workerInfo)],
      );

      const row = result.rows[0];
      if (!row) {
        await client.query('ROLLBACK');
        return null;
      }

      await client.query('COMMIT');
      logger.info(`✅ Worker 成功获取任务: ${row.id}, apiId=${row.api_id}`);

      return {
        id: row.id,
        apiId: row.api_id,
        authProfileId: row.auth_profile_id,
        input: row.input_payload || {},
        retryCount: row.retry_count,
      };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      logger.error('❌ 获取任务失败', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async releaseStaleTasks(timeoutSec: number, maxAttempts: number): Promise<{ released: number; failed: number }> {
    // 只对普通 running 任务做超时检查
    // polling-run 任务由 poll() 内部逻辑控制超时（maxPollCount）
    const releasedResult = await this.pool.query(
      `
      UPDATE task_runs_v2
      SET status = 'pending',
          retry_count = retry_count + 1,
          error_payload = jsonb_build_object(
            'code', 'TASK_TIMEOUT',
            'message', '任务执行超时，已重新入队'
          )
      WHERE status = 'running'
        AND started_at IS NOT NULL
        AND started_at < NOW() - ($1::text || ' seconds')::interval
        AND retry_count + 1 < $2
      `,
      [timeoutSec, maxAttempts],
    );

    const failedResult = await this.pool.query(
      `
      UPDATE task_runs_v2
      SET status = 'failed',
          retry_count = retry_count + 1,
          completed_at = NOW(),
          error_payload = jsonb_build_object(
            'code', 'TASK_TIMEOUT',
            'message', '任务执行超时且已超过最大重试次数'
          )
      WHERE status = 'running'
        AND started_at IS NOT NULL
        AND started_at < NOW() - ($1::text || ' seconds')::interval
        AND retry_count + 1 >= $2
      `,
      [timeoutSec, maxAttempts],
    );

    return {
      released: releasedResult.rowCount ?? 0,
      failed: failedResult.rowCount ?? 0,
    };
  }

  async handleTaskError(task: QueueTask, error: any, maxAttempts: number): Promise<void> {
    const nextRetry = task.retryCount + 1;

    if (nextRetry < maxAttempts) {
      await this.pool.query(
        `
        UPDATE task_runs_v2
        SET status = 'pending',
            retry_count = $2,
            error_payload = $3::jsonb
        WHERE id = $1 AND status = 'running'
        `,
        [
          task.id,
          nextRetry,
          JSON.stringify({
            code: 'TASK_EXECUTION_FAILED',
            message: error?.message || '任务执行失败，准备重试',
          }),
        ],
      );
      return;
    }

    await this.pool.query(
      `
      UPDATE task_runs_v2
      SET status = 'failed',
          retry_count = $2,
          completed_at = NOW(),
          error_payload = $3::jsonb
      WHERE id = $1 AND status = 'running'
      `,
      [
        task.id,
        nextRetry,
        JSON.stringify({
          code: 'TASK_EXECUTION_FAILED',
          message: error?.message || '任务执行失败',
          details: error?.stack,
        }),
      ],
    );
  }

  async softDelete(id: string): Promise<void> {
    logger.debug(`软删除任务: ${id}`);
    try {
      await this.pool.query(
        `UPDATE task_runs_v2 SET deleted = true WHERE id = $1`,
        [id],
      );
      logger.info(`任务已软删除: ${id}`);
    } catch (error) {
      logger.error(`软删除任务失败: ${id}`, error);
      throw error;
    }
  }

  async softDeleteMany(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    logger.debug(`批量软删除任务: ${ids.length} 个`);
    try {
      const result = await this.pool.query(
        `UPDATE task_runs_v2 SET deleted = true WHERE id = ANY($1)`,
        [ids],
      );
      logger.info(`批量软删除完成: ${result.rowCount} 个任务`);
      return result.rowCount ?? 0;
    } catch (error) {
      logger.error('批量软删除任务失败', error);
      throw error;
    }
  }

  async getTaskStats(): Promise<{ total: number; statusCounts: Record<string, number> }> {
    try {
      const totalResult = await this.pool.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM task_runs_v2 WHERE (deleted = false OR deleted IS NULL)`,
      );
      const total = parseInt(totalResult.rows[0].count, 10);

      const statusResult = await this.pool.query<{ status: string; count: string }>(
        `SELECT status, COUNT(*) as count FROM task_runs_v2 WHERE (deleted = false OR deleted IS NULL) GROUP BY status`,
      );
      const statusCounts: Record<string, number> = {};
      for (const row of statusResult.rows) {
        statusCounts[row.status] = parseInt(row.count, 10);
      }

      return { total, statusCounts };
    } catch (error) {
      logger.error('获取任务统计失败', error);
      throw error;
    }
  }

  async getTaskAnalytics(days = 14): Promise<{
    dailyTrend: Array<{ date: string; total: number; completed: number; failed: number }>;
    topApis: Array<{ apiId: string; count: number }>;
    avgDurationMs: number | null;
    totalRetries: number;
  }> {
    try {
      const dailyResult = await this.pool.query<{
        date: string;
        total: string;
        completed: string;
        failed: string;
      }>(
        `
        SELECT
          DATE(created_at)::text AS date,
          COUNT(*)::text AS total,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END)::text AS completed,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END)::text AS failed
        FROM task_runs_v2
        WHERE (deleted = false OR deleted IS NULL)
          AND created_at >= NOW() - ($1::integer * INTERVAL '1 day')
        GROUP BY DATE(created_at)
        ORDER BY date ASC
        `,
        [days],
      );

      const topApiResult = await this.pool.query<{ api_id: string; count: string }>(
        `
        SELECT api_id, COUNT(*)::text AS count
        FROM task_runs_v2
        WHERE (deleted = false OR deleted IS NULL)
        GROUP BY api_id
        ORDER BY count DESC
        LIMIT 8
        `,
      );

      const durationResult = await this.pool.query<{ avg_ms: string | null }>(
        `
        SELECT AVG(
          EXTRACT(EPOCH FROM (completed_at - started_at)) * 1000
        )::text AS avg_ms
        FROM task_runs_v2
        WHERE (deleted = false OR deleted IS NULL)
          AND status = 'completed'
          AND started_at IS NOT NULL
          AND completed_at IS NOT NULL
        `,
      );

      const retriesResult = await this.pool.query<{ total_retries: string }>(
        `
        SELECT COALESCE(SUM(retry_count), 0)::text AS total_retries
        FROM task_runs_v2
        WHERE (deleted = false OR deleted IS NULL)
        `,
      );

      const avgMsRaw = durationResult.rows[0]?.avg_ms;

      return {
        dailyTrend: dailyResult.rows.map((r) => ({
          date: r.date,
          total: parseInt(r.total, 10),
          completed: parseInt(r.completed, 10),
          failed: parseInt(r.failed, 10),
        })),
        topApis: topApiResult.rows.map((r) => ({
          apiId: r.api_id,
          count: parseInt(r.count, 10),
        })),
        avgDurationMs: avgMsRaw != null ? parseFloat(avgMsRaw) : null,
        totalRetries: parseInt(retriesResult.rows[0]?.total_retries ?? '0', 10),
      };
    } catch (error) {
      logger.error('获取任务分析数据失败', error);
      throw error;
    }
  }
}
