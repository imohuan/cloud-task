import type { Database } from 'bun:sqlite';
import type { TaskRun, TaskRunRepository, TaskStatus, ApiCallLog, QueueTask } from '@core/ports/task-run.repository';
import { Logger } from '../../../utils/logger';
import { randomUUID } from 'crypto';

const logger = new Logger('SqliteTaskRunRepository');

type TaskRunRow = {
  id: string;
  api_id: string;
  auth_profile_id: string;
  status: TaskStatus;
  input_payload: string;
  output_payload: string | null;
  error_payload: string | null;
  progress: number | null;
  retry_count: number;
  worker_info: string | null;
  api_call_logs: string | null;
  next_poll_at: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  deleted: number | null;
};

function parseJson<T>(raw: string | null): T | undefined {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

function mapTaskRun(row: TaskRunRow): TaskRun {
  return {
    id: row.id,
    apiId: row.api_id,
    authProfileId: row.auth_profile_id,
    status: row.status,
    input: parseJson<Record<string, any>>(row.input_payload) ?? {},
    output: parseJson<Record<string, any>>(row.output_payload),
    error: parseJson<TaskRun['error']>(row.error_payload),
    progress: row.progress ?? undefined,
    workerInfo: parseJson<TaskRun['workerInfo']>(row.worker_info),
    apiCallLogs: parseJson<ApiCallLog[]>(row.api_call_logs) ?? [],
    createdAt: new Date(row.created_at),
    startedAt: row.started_at ? new Date(row.started_at) : undefined,
    completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
    retryCount: row.retry_count,
    deleted: row.deleted === 1,
  };
}

export class SqliteTaskRunRepository implements TaskRunRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<TaskRun | null> {
    const startTime = Date.now();
    const stmt = this.db.prepare(
      `SELECT id, api_id, auth_profile_id, status, input_payload, output_payload, error_payload,
              progress, retry_count, worker_info, api_call_logs, next_poll_at, created_at, started_at, completed_at, deleted
       FROM task_runs_v2
       WHERE id = ?1 AND (deleted = 0 OR deleted IS NULL)
       LIMIT 1`
    );
    const row = stmt.get(id) as TaskRunRow | undefined;
    stmt.finalize();
    logger.debug(`查询任务: ${id}, 耗时: ${Date.now() - startTime}ms`);
    return row ? mapTaskRun(row) : null;
  }

  async create(task: Omit<TaskRun, 'id' | 'createdAt' | 'retryCount'>): Promise<TaskRun> {
    const startTime = Date.now();
    const id = randomUUID();

    const stmt = this.db.prepare(
      `INSERT INTO task_runs_v2 (
         id, api_id, auth_profile_id, status, input_payload, output_payload, error_payload,
         progress, started_at, completed_at, api_call_logs
       )
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
       RETURNING id, api_id, auth_profile_id, status, input_payload, output_payload, error_payload,
                 progress, retry_count, worker_info, api_call_logs, next_poll_at, created_at, started_at, completed_at, deleted`
    );
    const row = stmt.get(
      id,
      task.apiId,
      task.authProfileId,
      task.status,
      JSON.stringify(task.input ?? {}),
      task.output ? JSON.stringify(task.output) : null,
      task.error ? JSON.stringify(task.error) : null,
      task.progress ?? null,
      task.startedAt ? task.startedAt.toISOString() : null,
      task.completedAt ? task.completedAt.toISOString() : null,
      JSON.stringify(task.apiCallLogs ?? []),
    ) as TaskRunRow;
    stmt.finalize();

    logger.info(`任务创建成功: ${row.id}, 耗时: ${Date.now() - startTime}ms`);
    return mapTaskRun(row);
  }

  async updateStatus(
    id: string,
    status: TaskStatus,
    updates?: Partial<Pick<TaskRun, 'output' | 'error' | 'progress' | 'completedAt' | 'startedAt' | 'workerInfo' | 'apiCallLogs'>> & { nextPollAt?: Date },
  ): Promise<TaskRun> {
    const stmt = this.db.prepare(
      `UPDATE task_runs_v2
       SET status = ?1,
           output_payload = COALESCE(?2, output_payload),
           error_payload = COALESCE(?3, error_payload),
           progress = COALESCE(?4, progress),
           completed_at = COALESCE(?5, completed_at),
           started_at = COALESCE(?6, started_at),
           worker_info = COALESCE(?7, worker_info),
           api_call_logs = COALESCE(?8, api_call_logs),
           next_poll_at = COALESCE(?9, next_poll_at)
       WHERE id = ?10
       RETURNING id, api_id, auth_profile_id, status, input_payload, output_payload, error_payload,
                 progress, retry_count, worker_info, api_call_logs, next_poll_at, created_at, started_at, completed_at, deleted`
    );
    const row = stmt.get(
      status,
      updates?.output ? JSON.stringify(updates.output) : null,
      updates?.error ? JSON.stringify(updates.error) : null,
      updates?.progress ?? null,
      updates?.completedAt ? updates.completedAt.toISOString() : null,
      updates?.startedAt ? updates.startedAt.toISOString() : null,
      updates?.workerInfo ? JSON.stringify(updates.workerInfo) : null,
      updates?.apiCallLogs ? JSON.stringify(updates.apiCallLogs) : null,
      updates?.nextPollAt ? updates.nextPollAt.getTime() : null,
      id,
    ) as TaskRunRow | undefined;
    stmt.finalize();

    if (!row) {
      throw new Error('任务不存在');
    }
    return mapTaskRun(row);
  }

  async getPendingTasks(limit = 20): Promise<TaskRun[]> {
    const stmt = this.db.prepare(
      `SELECT id, api_id, auth_profile_id, status, input_payload, output_payload, error_payload,
              progress, retry_count, worker_info, api_call_logs, next_poll_at, created_at, started_at, completed_at, deleted
       FROM task_runs_v2
       WHERE status = 'pending' AND (deleted = 0 OR deleted IS NULL)
       ORDER BY created_at ASC
       LIMIT ?1`
    );
    const rows = stmt.all(limit) as TaskRunRow[];
    stmt.finalize();
    return rows.map(mapTaskRun);
  }

  async findByIds(ids: string[]): Promise<TaskRun[]> {
    if (ids.length === 0) return [];
    const placeholders = ids.map((_, i) => `?${i + 1}`).join(', ');
    const stmt = this.db.prepare(
      `SELECT id, api_id, auth_profile_id, status, input_payload, output_payload, error_payload,
              progress, retry_count, worker_info, api_call_logs, next_poll_at, created_at, started_at, completed_at, deleted
       FROM task_runs_v2
       WHERE id IN (${placeholders}) AND (deleted = 0 OR deleted IS NULL)`
    );
    const rows = stmt.all(...ids) as TaskRunRow[];
    stmt.finalize();
    return rows.map(mapTaskRun);
  }

  async queryTasks(filters: {
    status?: TaskStatus;
    search?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ tasks: TaskRun[]; total: number; page: number; pageSize: number }> {
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 20));
    const offset = (page - 1) * pageSize;

    const conditions: string[] = [];
    const values: any[] = [];

    if (filters.status) {
      conditions.push(`status = ?${values.length + 1}`);
      values.push(filters.status);
    }
    // 默认排除已删除的任务
    conditions.push(`(deleted = 0 OR deleted IS NULL)`);
    if (filters.search) {
      conditions.push(`(LOWER(id) LIKE LOWER(?${values.length + 1}) OR LOWER(api_id) LIKE LOWER(?${values.length + 2}))`);
      values.push(`%${filters.search}%`, `%${filters.search}%`);
    }
    if (filters.startDate) {
      conditions.push(`created_at >= ?${values.length + 1}`);
      values.push(new Date(filters.startDate).toISOString());
    }
    if (filters.endDate) {
      const end = new Date(filters.endDate);
      end.setHours(23, 59, 59, 999);
      conditions.push(`created_at <= ?${values.length + 1}`);
      values.push(end.toISOString());
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countStmt = this.db.prepare(`SELECT COUNT(*) as count FROM task_runs_v2 ${whereClause}`);
    const countRow = countStmt.get(...values) as { count: number } | undefined;
    countStmt.finalize();
    const total = countRow ? Number(countRow.count) : 0;

    const dataStmt = this.db.prepare(
      `SELECT id, api_id, auth_profile_id, status, input_payload, output_payload, error_payload,
              progress, retry_count, worker_info, api_call_logs, next_poll_at, created_at, started_at, completed_at, deleted
       FROM task_runs_v2
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT ?${values.length + 1} OFFSET ?${values.length + 2}`
    );
    const rows = dataStmt.all(...values, pageSize, offset) as TaskRunRow[];
    dataStmt.finalize();

    return {
      tasks: rows.map(mapTaskRun),
      total,
      page,
      pageSize,
    };
  }

  async getRecentTasks(limit = 50): Promise<TaskRun[]> {
    const stmt = this.db.prepare(
      `SELECT id, api_id, auth_profile_id, status, input_payload, output_payload, error_payload,
              progress, retry_count, worker_info, api_call_logs, next_poll_at, created_at, started_at, completed_at, deleted
       FROM task_runs_v2
       WHERE (deleted = 0 OR deleted IS NULL)
       ORDER BY created_at DESC
       LIMIT ?1`
    );
    const rows = stmt.all(limit) as TaskRunRow[];
    stmt.finalize();
    return rows.map(mapTaskRun);
  }

  async incrementRetryCount(id: string): Promise<void> {
    const stmt = this.db.prepare(
      `UPDATE task_runs_v2 SET retry_count = retry_count + 1 WHERE id = ?1`
    );
    stmt.run(id);
    stmt.finalize();
    logger.debug(`增加重试次数: ${id}`);
  }

  async claimNextTask(workerInfo: Record<string, any>): Promise<QueueTask | null> {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const selectStmt = this.db.prepare(
        `SELECT id, api_id, auth_profile_id, input_payload, retry_count
         FROM task_runs_v2
         WHERE (status = 'pending'
            OR (status = 'polling' AND next_poll_at IS NOT NULL AND next_poll_at <= (strftime('%s', 'now') * 1000)))
           AND (deleted = 0 OR deleted IS NULL)
         ORDER BY
           CASE WHEN status = 'pending' THEN 0 ELSE 1 END,
           created_at ASC
         LIMIT 1`
      );
      const row = selectStmt.get() as TaskRunRow | undefined;
      selectStmt.finalize();

      if (!row) {
        this.db.exec('ROLLBACK');
        return null;
      }

      const updateStmt = this.db.prepare(
        `UPDATE task_runs_v2
         SET status = CASE WHEN status = 'polling' THEN 'polling-run' ELSE 'running' END,
             started_at = CASE WHEN status = 'pending' THEN datetime('now') ELSE started_at END,
             progress = CASE WHEN progress IS NULL OR progress < 5 THEN 5 ELSE progress END,
             worker_info = ?1
         WHERE id = ?2`
      );
      updateStmt.run(JSON.stringify(workerInfo), row.id);
      updateStmt.finalize();

      this.db.exec('COMMIT');
      logger.info(`✅ Worker 成功获取任务: ${row.id}, apiId=${row.api_id}`);

      return {
        id: row.id,
        apiId: row.api_id,
        authProfileId: row.auth_profile_id,
        input: parseJson<Record<string, any>>(row.input_payload) ?? {},
        retryCount: row.retry_count,
      };
    } catch (error) {
      this.db.exec('ROLLBACK');
      logger.error('❌ 获取任务失败', error);
      throw error;
    }
  }

  async releaseStaleTasks(timeoutSec: number, maxAttempts: number): Promise<{ released: number; failed: number }> {
    const threshold = new Date(Date.now() - timeoutSec * 1000).toISOString();

    // 只对普通 running 任务做超时检查
    // polling-run 任务由 poll() 内部逻辑控制超时（maxPollCount）
    const releaseStmt = this.db.prepare(
      `UPDATE task_runs_v2
       SET status = 'pending',
           retry_count = retry_count + 1,
           error_payload = ?1
       WHERE status = 'running'
         AND started_at IS NOT NULL
         AND started_at < ?2
         AND retry_count + 1 < ?3`
    );
    const releaseResult = releaseStmt.run(
      JSON.stringify({ code: 'TASK_TIMEOUT', message: '任务执行超时，已重新入队' }),
      threshold,
      maxAttempts,
    );
    releaseStmt.finalize();

    const failStmt = this.db.prepare(
      `UPDATE task_runs_v2
       SET status = 'failed',
           retry_count = retry_count + 1,
           completed_at = datetime('now'),
           error_payload = ?1
       WHERE status = 'running'
         AND started_at IS NOT NULL
         AND started_at < ?2
         AND retry_count + 1 >= ?3`
    );
    const failResult = failStmt.run(
      JSON.stringify({ code: 'TASK_TIMEOUT', message: '任务执行超时且已超过最大重试次数' }),
      threshold,
      maxAttempts,
    );
    failStmt.finalize();

    return {
      released: releaseResult.changes,
      failed: failResult.changes,
    };
  }

  async handleTaskError(task: QueueTask, error: any, maxAttempts: number): Promise<void> {
    const nextRetry = task.retryCount + 1;

    if (nextRetry < maxAttempts) {
      const stmt = this.db.prepare(
        `UPDATE task_runs_v2
         SET status = 'pending',
             retry_count = ?2,
             error_payload = ?3
         WHERE id = ?1 AND status = 'running'`
      );
      stmt.run(
        task.id,
        nextRetry,
        JSON.stringify({
          code: 'TASK_EXECUTION_FAILED',
          message: error?.message || '任务执行失败，准备重试',
        }),
      );
      stmt.finalize();
      return;
    }

    const stmt = this.db.prepare(
      `UPDATE task_runs_v2
       SET status = 'failed',
           retry_count = ?2,
           completed_at = datetime('now'),
           error_payload = ?3
       WHERE id = ?1 AND status = 'running'`
    );
    stmt.run(
      task.id,
      nextRetry,
      JSON.stringify({
        code: 'TASK_EXECUTION_FAILED',
        message: error?.message || '任务执行失败',
        details: error?.stack,
      }),
    );
    stmt.finalize();
  }

  async softDelete(id: string): Promise<void> {
    logger.debug(`软删除任务: ${id}`);
    const stmt = this.db.prepare(`UPDATE task_runs_v2 SET deleted = 1 WHERE id = ?1`);
    stmt.run(id);
    stmt.finalize();
    logger.info(`任务已软删除: ${id}`);
  }

  async softDeleteMany(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    logger.debug(`批量软删除任务: ${ids.length} 个`);
    const placeholders = ids.map((_, i) => `?${i + 1}`).join(', ');
    const stmt = this.db.prepare(`UPDATE task_runs_v2 SET deleted = 1 WHERE id IN (${placeholders})`);
    const result = stmt.run(...ids);
    stmt.finalize();
    logger.info(`批量软删除完成: ${result.changes} 个任务`);
    return result.changes;
  }

  async getTaskStats(): Promise<{ total: number; statusCounts: Record<string, number> }> {
    const totalStmt = this.db.prepare(`SELECT COUNT(*) as count FROM task_runs_v2 WHERE (deleted = 0 OR deleted IS NULL)`);
    const totalRow = totalStmt.get() as { count: number } | undefined;
    totalStmt.finalize();

    const statusStmt = this.db.prepare(`SELECT status, COUNT(*) as count FROM task_runs_v2 WHERE (deleted = 0 OR deleted IS NULL) GROUP BY status`);
    const statusRows = statusStmt.all() as { status: string; count: number }[];
    statusStmt.finalize();

    const statusCounts: Record<string, number> = {};
    for (const row of statusRows) {
      statusCounts[row.status] = Number(row.count);
    }

    return { total: Number(totalRow?.count ?? 0), statusCounts };
  }

  async getTaskAnalytics(days = 14): Promise<{
    dailyTrend: Array<{ date: string; total: number; completed: number; failed: number }>;
    topApis: Array<{ apiId: string; count: number }>;
    avgDurationMs: number | null;
    totalRetries: number;
  }> {
    const cutoff = `'-${days} days'`;

    const dailyStmt = this.db.prepare(`
      SELECT
        date(created_at) as date,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM task_runs_v2
      WHERE (deleted = 0 OR deleted IS NULL)
        AND created_at >= datetime('now', ${cutoff})
      GROUP BY date(created_at)
      ORDER BY date ASC
    `);
    const dailyRows = dailyStmt.all() as Array<{ date: string; total: number; completed: number; failed: number }>;
    dailyStmt.finalize();

    const topApiStmt = this.db.prepare(`
      SELECT api_id, COUNT(*) as count
      FROM task_runs_v2
      WHERE (deleted = 0 OR deleted IS NULL)
      GROUP BY api_id
      ORDER BY count DESC
      LIMIT 8
    `);
    const topApiRows = topApiStmt.all() as Array<{ api_id: string; count: number }>;
    topApiStmt.finalize();

    const durationStmt = this.db.prepare(`
      SELECT AVG(
        (julianday(completed_at) - julianday(started_at)) * 86400000
      ) as avg_ms
      FROM task_runs_v2
      WHERE (deleted = 0 OR deleted IS NULL)
        AND status = 'completed'
        AND started_at IS NOT NULL
        AND completed_at IS NOT NULL
    `);
    const durationRow = durationStmt.get() as { avg_ms: number | null } | undefined;
    durationStmt.finalize();

    const retriesStmt = this.db.prepare(`
      SELECT COALESCE(SUM(retry_count), 0) as total_retries
      FROM task_runs_v2
      WHERE (deleted = 0 OR deleted IS NULL)
    `);
    const retriesRow = retriesStmt.get() as { total_retries: number } | undefined;
    retriesStmt.finalize();

    return {
      dailyTrend: dailyRows.map(r => ({
        date: r.date,
        total: Number(r.total),
        completed: Number(r.completed),
        failed: Number(r.failed),
      })),
      topApis: topApiRows.map(r => ({ apiId: r.api_id, count: Number(r.count) })),
      avgDurationMs: durationRow?.avg_ms ?? null,
      totalRetries: Number(retriesRow?.total_retries ?? 0),
    };
  }
}
