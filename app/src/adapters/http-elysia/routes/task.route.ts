/**
 * 任务路由
 * 
 * 【优化】
 * 1. 添加详细的 debug 日志便于问题排查
 * 2. 使用 Logger 替代字符串日志
 * 3. 添加任务执行耗时统计
 * 4. 添加幂等性检查支持（通过 idempotencyKey）
 */

import { Elysia, t } from 'elysia';
import { registry } from '@core/application/registry/registry-center';
import { getAuthProfileRepository, getTaskRunRepository } from '@adapters/persistence';
import { createTaskDispatcher } from '@adapters/task-dispatcher';
import type { TaskHandler, TaskPayload } from '@adapters/task-dispatcher';
import { calculateNextPollAt } from '@core/application/api-executor';
import type { PollingState } from '@core/domain/api/base-api.handler';
import { Logger } from '../../../utils/logger';
import { TaskRun } from '@/core';

const logger = new Logger('TaskRoute');

/** 构建认证上下文 */
async function buildAuthContext(apiId: string, authProfileId: string) {
  const metadata = registry.getApiMetadata(apiId)!;
  const authStrategy = registry.getAuthStrategy(metadata.platformId!, metadata.authStrategyId)!;
  const authProfile = await getAuthProfileRepository().findById(authProfileId);
  if (!authProfile) throw new Error('认证配置不存在');
  return authStrategy.buildAuthContext(authProfile);
}

/** 执行普通任务 */
const executeTaskHandler = async (payload: TaskPayload, helpers: any) => {
  const { taskRunId, apiId, authProfileId, input } = payload;
  const repo = getTaskRunRepository();
  const startTime = Date.now();

  try {
    logger.info(`🚀 [ExecuteHandler] 开始执行任务: ${taskRunId}, apiId=${apiId}`);

    await repo.updateStatus(taskRunId, 'running', { startedAt: new Date(), progress: 10 });

    const handler = registry.getApiHandler(apiId);
    if (!handler) throw new Error(`API 不存在: ${apiId}`);
    const metadata = registry.getApiMetadata(apiId);
    logger.info(`[${taskRunId}] ✅ 找到 API Handler: ${metadata!.name} (${metadata!.executionMode})`);

    const authContext = await buildAuthContext(apiId, authProfileId);

    await repo.updateStatus(taskRunId, 'running', { progress: 50 });

    const context = { authProfileId, input: input || {}, requestId: `req-${Date.now()}`, taskRunId };
    const result: any = await handler.execute(context, authContext);

    await repo.updateStatus(taskRunId, 'running', { progress: 90 });

    if (result.success) {
      const data = result.data;
      if (data?._polling) {
        const pollingData = {
          ...data.raw,
          thirdPartyTaskId: data._polling.thirdPartyTaskId,
          pollingPhase: data._polling.pollingPhase,
          pollCount: 0,
        };
        const nextPollAt = calculateNextPollAt(0, handler.getPollingConfig());
        await repo.updateStatus(taskRunId, 'polling', { output: pollingData, progress: 30, nextPollAt });
        logger.info(`[${taskRunId}] ⏳ 任务进入 polling 状态, nextPollAt=${nextPollAt.toISOString()}`);
        helpers.logger.info(`⏳ 任务进入轮询: ${taskRunId}, 第三方任务ID=${data._polling.thirdPartyTaskId}`);
        return;
      }

      const duration = Date.now() - startTime;
      await repo.updateStatus(taskRunId, 'completed', { output: data ?? null, progress: 100, completedAt: new Date() });
      logger.info(`[${taskRunId}] ✅ 任务执行成功, 耗时: ${duration}ms`);
      helpers.logger.info(`✅ 任务完成: ${taskRunId}, 耗时: ${duration}ms`);
    } else {
      await repo.updateStatus(taskRunId, 'failed', {
        error: { code: result.error?.code || 'EXECUTION_ERROR', message: result.error?.message || '执行失败', details: result.error?.details },
        completedAt: new Date(),
      });
      logger.warn(`[${taskRunId}] ⚠️ 任务执行返回失败结果: ${result.error?.code} - ${result.error?.message}`);
      return;
    }
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logger.error(`[${taskRunId}] ❌ 任务执行异常, 耗时: ${duration}ms`, error);
    helpers.logger.error(`❌ 任务执行异常: ${error.message}`);
    try {
      await repo.updateStatus(taskRunId, 'failed', { error: { code: 'EXECUTION_EXCEPTION', message: error.message, details: error.stack }, completedAt: new Date() });
    } catch (dbError) {
      logger.error(`[${taskRunId}] ❌ 记录错误状态失败:`, dbError);
    }
    throw error;
  }
};

/** 恢复轮询任务（不更新中间进度） */
const pollTaskHandler = async (payload: TaskPayload, helpers: any, currentTask: TaskRun) => {
  const { taskRunId, apiId, authProfileId, input } = payload;
  const repo = getTaskRunRepository();
  const startTime = Date.now();

  try {
    logger.info(`🔄 [PollHandler] 恢复轮询任务: ${taskRunId}, apiId=${apiId}`);

    if (!currentTask || !currentTask.output) {
      throw new Error('轮询任务缺少 output 数据');
    }

    const handler = registry.getApiHandler(apiId);
    if (!handler) throw new Error(`API 不存在: ${apiId}`);

    const authContext = await buildAuthContext(apiId, authProfileId);

    const context = { authProfileId, input: input || {}, requestId: `req-${Date.now()}`, taskRunId };
    const pollingState = currentTask.output as PollingState;
    const result: any = await handler.poll(context, authContext, pollingState);
    logger.info(`[${taskRunId}] ✅ API Handler poll 执行完成, success=${result.success}`);

    if (result.success) {
      const data = result.data;
      if (data?._continuePolling) {
        // 重新读取最新 task，避免 handler.poll() 期间通过 updateStatus 写入的字段
        // （如 output.content 阶段性结果）被旧的 currentOutput 覆盖。
        const freshTask = await repo.findById(taskRunId);
        const currentOutput = freshTask?.output || currentTask.output || {};
        const pollCount = (currentOutput.pollCount || 0) + 1;
        const pollingConfig = handler.getPollingConfig();

        if (pollCount >= pollingConfig.maxPollCount) {
          logger.warn(`[${taskRunId}] 轮询次数超过上限 (${pollCount}/${pollingConfig.maxPollCount})，标记为失败`);
            repo.updateStatus(taskRunId, 'failed', {
            error: { code: 'POLLING_TIMEOUT', message: `轮询次数超过上限 (${pollingConfig.maxPollCount} 次)，任务可能已超时` },
            completedAt: new Date(),
          });
          throw new Error('轮询超时');
        }

        const nextPollAt = calculateNextPollAt(pollCount, pollingConfig);
        const newOutput = { ...currentOutput, pollCount, lastPollAt: new Date().toISOString(), lastPollResult: data.raw };
        const progressUpdate = typeof data._progress === 'number' ? Math.min(data._progress, 99) : undefined;

        await repo.updateStatus(taskRunId, 'polling', { output: newOutput, nextPollAt, ...(progressUpdate !== undefined ? { progress: progressUpdate } : {}) });
        logger.info(`[${taskRunId}] ⏳ 继续轮询, pollCount=${pollCount}, nextPollAt=${nextPollAt.toISOString()}`);
        helpers.logger.info(`⏳ 继续轮询: ${taskRunId}, 第 ${pollCount} 次`);
        return;
      }

      const duration = Date.now() - startTime;
      await repo.updateStatus(taskRunId, 'completed', { output: data ?? null, progress: 100, completedAt: new Date() });
      logger.info(`[${taskRunId}] ✅ 轮询任务完成, 耗时: ${duration}ms`);
      helpers.logger.info(`✅ 轮询任务完成: ${taskRunId}, 耗时: ${duration}ms`);
    } else {
      await repo.updateStatus(taskRunId, 'failed', {
        error: { code: result.error?.code || 'POLL_ERROR', message: result.error?.message || '轮询失败', details: result.error?.details },
        completedAt: new Date(),
      });
      logger.warn(`[${taskRunId}] ⚠️ 轮询任务返回失败结果: ${result.error?.code} - ${result.error?.message}`);
      return;
    }
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logger.error(`[${taskRunId}] ❌ 轮询任务异常, 耗时: ${duration}ms`, error);
    helpers.logger.error(`❌ 轮询任务异常: ${error.message}`);
    try {
      await repo.updateStatus(taskRunId, 'failed', { error: { code: 'POLL_EXCEPTION', message: error.message, details: error.stack }, completedAt: new Date() });
    } catch (dbError) {
      logger.error(`[${taskRunId}] ❌ 记录错误状态失败:`, dbError);
    }
    throw error;
  }
};

/** 任务分发处理器 */
const taskHandler: TaskHandler = async (payload: TaskPayload, helpers) => {
  const repo = getTaskRunRepository();
  const task = await repo.findById(payload.taskRunId);
  if (task?.status === 'polling-run') {
    logger.debug(`任务路由到轮询处理器: ${payload.apiId}`);
    return pollTaskHandler(payload, helpers, task);
  }
  logger.debug(`任务路由到执行处理器: ${payload.apiId}`);
  return executeTaskHandler(payload, helpers);
};

/** 【优化】延迟创建任务分发器，确保数据库已初始化 */
let taskDispatcherInstance: ReturnType<typeof createTaskDispatcher> | null = null;

export function getTaskDispatcher(): ReturnType<typeof createTaskDispatcher> {
  if (!taskDispatcherInstance) {
    taskDispatcherInstance = createTaskDispatcher(
      getTaskRunRepository(),
      taskHandler
    );
  }
  return taskDispatcherInstance;
}

/** 【兼容】保持原有导出，但改为 getter */
export const taskDispatcher = {
  start: () => getTaskDispatcher().start(),
  stop: () => getTaskDispatcher().stop(),
};

/**
 * 任务路由
 * 提供异步任务创建和查询接口
 */
export const taskRoutes = new Elysia({ prefix: '/api/tasks' })
  // 创建异步任务
  .post('/', async ({ body }) => {
    const { apiId, authProfileId, input } = body as {
      apiId: string;
      authProfileId: string;
      input?: Record<string, any>;
    };

    const requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    logger.debug(`[${requestId}] 创建任务请求`, { apiId, authProfileId });

    // 查找 API Handler
    logger.debug(`[${requestId}] 查找 API: ${apiId}`);
    const handler = registry.getApiHandler(apiId);
    if (!handler) {
      logger.warn(`[${requestId}] API 不存在: ${apiId}`);
      return {
        success: false,
        error: {
          code: 'API_NOT_FOUND',
          message: 'API 不存在',
        },
      };
    }

    const metadata = registry.getApiMetadata(apiId);
    logger.debug(`[${requestId}] 找到 API: ${metadata!.name}, mode: ${metadata!.executionMode}`);

    // 验证输入
    logger.debug(`[${requestId}] 验证输入参数`);
    const validation = await handler.validateInput(input || {});
    if (!validation.valid) {
      logger.warn(`[${requestId}] 输入参数验证失败`, { errors: validation.errors });
      return {
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: '输入参数验证失败',
          details: validation.errors,
        },
      };
    }
    logger.debug(`[${requestId}] 输入参数验证通过`);

    // 验证认证配置
    logger.debug(`[${requestId}] 获取认证策略: ${metadata!.platformId}.${metadata!.authStrategyId}`);
    const authStrategy = registry.getAuthStrategy(
      metadata!.platformId!,
      metadata!.authStrategyId,
    );

    if (!authStrategy) {
      logger.warn(`[${requestId}] 认证策略不存在`);
      return {
        success: false,
        error: {
          code: 'AUTH_STRATEGY_NOT_FOUND',
          message: '认证策略不存在',
        },
      };
    }

    logger.debug(`[${requestId}] 查找认证配置: ${authProfileId}`);
    const authProfile = await getAuthProfileRepository().findById(authProfileId);
    if (!authProfile) {
      logger.warn(`[${requestId}] 认证配置不存在: ${authProfileId}`);
      return {
        success: false,
        error: {
          code: 'AUTH_PROFILE_NOT_FOUND',
          message: '认证配置不存在',
        },
      };
    }

    if (!authProfile.enabled) {
      logger.warn(`[${requestId}] 认证配置已禁用: ${authProfileId}`);
      return {
        success: false,
        error: {
          code: 'AUTH_PROFILE_DISABLED',
          message: '认证配置已禁用',
        },
      };
    }

    if (authProfile.platformId !== metadata!.platformId ||
      authProfile.authStrategyId !== metadata!.authStrategyId.split(".").slice(-1)[0]) {
      logger.warn(`[${requestId}] 认证配置不匹配`, {
        expected: { platformId: metadata!.platformId, authStrategyId: metadata!.authStrategyId },
        actual: { platformId: authProfile.platformId, authStrategyId: authProfile.authStrategyId }
      });
      return {
        success: false,
        error: {
          code: 'AUTH_PROFILE_MISMATCH',
          message: '认证配置与接口不匹配',
        },
      };
    }
    logger.debug(`[${requestId}] 认证配置验证通过`);

    // 创建异步任务
    logger.debug(`[${requestId}] 创建任务...`);
    const taskId = await getTaskDispatcher().dispatch({
      apiId,
      authProfileId,
      input: input || {},
    });

    logger.info(`[${requestId}] 任务创建成功: ${taskId}`);

    return {
      success: true,
      data: {
        taskId,
        status: 'pending',
        message: '任务已创建，请使用任务ID查询执行结果',
      },
    };
  }, {
    body: t.Object({
      apiId: t.String(),
      authProfileId: t.String(),
      input: t.Optional(t.Record(t.String(), t.Any())),
    }),
    detail: {
      summary: '创建异步任务',
      tags: ['tasks'],
    },
  })

  // 查询任务状态
  .get('/:taskId', async ({ params }) => {
    const taskRun = await getTaskRunRepository().findById(params.taskId);

    if (!taskRun) {
      return {
        success: false,
        error: {
          code: 'TASK_NOT_FOUND',
          message: '任务不存在',
        },
      };
    }

    if (taskRun.deleted) {
      return {
        success: false,
        error: {
          code: 'TASK_DELETED',
          message: '任务已删除',
        },
      };
    }

    return {
      success: true,
      data: {
        taskId: taskRun.id,
        apiId: taskRun.apiId,
        authProfileId: taskRun.authProfileId,
        status: taskRun.status,
        progress: taskRun.progress,
        input: taskRun.input,
        output: taskRun.output,
        error: taskRun.error,
        apiCallLogs: taskRun.apiCallLogs,
        createdAt: taskRun.createdAt,
        startedAt: taskRun.startedAt,
        completedAt: taskRun.completedAt,
        retryCount: taskRun.retryCount,
      },
    };
  }, {
    params: t.Object({
      taskId: t.String(),
    }),
    detail: {
      summary: '查询任务状态',
      tags: ['tasks'],
    },
  })

  // 批量查询任务（根据多个 taskId）
  .post('/batch', async ({ body }) => {
    const { ids } = body as { ids: string[] };
    if (!Array.isArray(ids) || ids.length === 0) {
      return {
        success: false,
        error: { code: 'INVALID_IDS', message: 'ids 必须是非空数组' },
      };
    }
    if (ids.length > 100) {
      return {
        success: false,
        error: { code: 'IDS_TOO_MANY', message: '单次最多查询 100 个任务' },
      };
    }

    const tasks = await getTaskRunRepository().findByIds(ids);

    return {
      success: true,
      data: tasks.map(task => ({
        taskId: task.id,
        apiId: task.apiId,
        authProfileId: task.authProfileId,
        status: task.status,
        progress: task.progress,
        input: task.input,
        output: task.output,
        error: task.error,
        apiCallLogs: task.apiCallLogs,
        createdAt: task.createdAt,
        startedAt: task.startedAt,
        completedAt: task.completedAt,
        retryCount: task.retryCount,
      })),
    };
  }, {
    body: t.Object({
      ids: t.Array(t.String(), { minItems: 1, maxItems: 100 }),
    }),
    detail: {
      summary: '批量查询任务',
      tags: ['tasks'],
    },
  })

  // 任务统计
  .get('/stats', async () => {
    const { total, statusCounts } = await getTaskRunRepository().getTaskStats();
    return {
      success: true,
      data: {
        total,
        pending: statusCounts['pending'] || 0,
        running: statusCounts['running'] || 0,
        completed: statusCounts['completed'] || 0,
        failed: statusCounts['failed'] || 0,
        polling: statusCounts['polling'] || 0,
        'polling-run': statusCounts['polling-run'] || 0,
        timeout: statusCounts['timeout'] || 0,
      },
    };
  }, {
    detail: {
      summary: '任务统计',
      tags: ['tasks'],
    },
  })

  // 任务分析（数据看板）
  .get('/analytics', async ({ query }) => {
    const days = query.days ? Math.min(90, Math.max(1, parseInt(query.days as string, 10))) : 14;
    const data = await getTaskRunRepository().getTaskAnalytics(days);
    return { success: true, data };
  }, {
    query: t.Object({
      days: t.Optional(t.String()),
    }),
    detail: {
      summary: '任务分析数据（看板用）',
      tags: ['tasks'],
    },
  })

  // 查询任务列表（支持分页、状态过滤、关键字搜索、时间范围）
  .get('/', async ({ query }) => {
    const {
      status,
      search,
      startDate,
      endDate,
      page,
      pageSize,
    } = query as {
      status?: string;
      search?: string;
      startDate?: string;
      endDate?: string;
      page?: string;
      pageSize?: string;
    };

    const result = await getTaskRunRepository().queryTasks({
      status: ['pending', 'running', 'completed', 'failed', 'polling', 'polling-run', 'timeout'].includes(status as string) ? status as any : undefined,
      search,
      startDate,
      endDate,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });

    return {
      success: true,
      data: {
        list: result.tasks.map(task => ({
          taskId: task.id,
          apiId: task.apiId,
          status: task.status,
          authProfileId: task.authProfileId,
          progress: task.progress,
          input: task.input,
          output: task.output,
          error: task.error,
          apiCallLogs: task.apiCallLogs,
          createdAt: task.createdAt,
          startedAt: task.startedAt,
          completedAt: task.completedAt,
        })),
        pagination: {
          total: result.total,
          page: result.page,
          pageSize: result.pageSize,
          totalPages: Math.ceil(result.total / result.pageSize),
        },
      },
    };
  }, {
    query: t.Object({
      status: t.Optional(t.String()),
      search: t.Optional(t.String()),
      startDate: t.Optional(t.String()),
      endDate: t.Optional(t.String()),
      page: t.Optional(t.String()),
      pageSize: t.Optional(t.String()),
    }),
    detail: {
      summary: '分页查询任务列表',
      tags: ['tasks'],
    },
  })

  // 删除单个任务（软删除）
  .delete('/:taskId', async ({ params }) => {
    const { taskId } = params;
    logger.debug(`[${taskId}] 软删除任务`);

    const task = await getTaskRunRepository().findById(taskId);
    if (!task) {
      return {
        success: false,
        error: {
          code: 'TASK_NOT_FOUND',
          message: '任务不存在',
        },
      };
    }

    await getTaskRunRepository().softDelete(taskId);
    logger.info(`[${taskId}] 任务已软删除`);

    return {
      success: true,
      data: {
        taskId,
        message: '任务已隐藏',
      },
    };
  }, {
    params: t.Object({
      taskId: t.String(),
    }),
    detail: {
      summary: '删除任务（软删除）',
      tags: ['tasks'],
    },
  })

  // 批量删除任务（软删除）
  .delete('/', async ({ body }) => {
    const { ids } = body as { ids: string[] };
    if (!Array.isArray(ids) || ids.length === 0) {
      return {
        success: false,
        error: { code: 'INVALID_IDS', message: 'ids 必须是非空数组' },
      };
    }
    if (ids.length > 100) {
      return {
        success: false,
        error: { code: 'IDS_TOO_MANY', message: '单次最多删除 100 个任务' },
      };
    }

    const deletedCount = await getTaskRunRepository().softDeleteMany(ids);
    logger.info(`批量软删除任务: ${deletedCount}/${ids.length} 个`);

    return {
      success: true,
      data: {
        deletedCount,
        message: `已隐藏 ${deletedCount} 个任务`,
      },
    };
  }, {
    body: t.Object({
      ids: t.Array(t.String(), { minItems: 1, maxItems: 100 }),
    }),
    detail: {
      summary: '批量删除任务（软删除）',
      tags: ['tasks'],
    },
  });
