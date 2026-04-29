import { BaseApiHandler } from '@core/domain/api/base-api.handler';
import type { ApiCallContext, ApiMetadata, SyncApiResult } from '@core/contracts/api.types';
import type { AuthContext } from '@core/contracts/auth.types';
import type { ApiCallLog } from '@core/ports/task-run.repository';
import { getTaskRunRepository } from '@adapters/persistence';
import { Logger } from '@utils/logger';

const logger = new Logger('QueryImageTask');

/**
 * 任务查询参数
 */
interface QueryImageTaskInput {
  taskId: string;
}

/**
 * 任务查询响应
 */
interface QueryImageTaskOutput {
  taskId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  imageUrl?: string;
  error?: string;
  apiCallLogs: ApiCallLog[];
  createdAt: string;
  completedAt?: string;
}

/**
 * 云雾平台 - 图片任务查询接口
 * 
 * 执行流程：
 * 1. 接收任务ID查询请求
 * 2. 从数据库查询任务记录
 * 3. 返回任务状态、进度、结果（如有）
 */
export class QueryImageTaskApiHandler extends BaseApiHandler<QueryImageTaskInput, QueryImageTaskOutput> {
  getMetadata(): ApiMetadata {
    return {
      id: 'query',
      name: '查询图片任务',
      description: '查询图片生成任务的状态和结果',
      authStrategyId: 'api-key',
      executionMode: 'sync',
      enabled: true,
      version: '1.0.0',
      tags: ['image', 'task', 'query'],
      inputSchema: {
        description: '任务查询参数',
        fields: [
          {
            name: 'taskId',
            type: 'string',
            required: true,
            description: '任务 ID（调用生成接口返回的 taskId）',
            uiHint: 'text',
          },
        ],
      },
      outputSchema: {
        description: '任务查询结果',
        fields: [
          {
            name: 'taskId',
            type: 'string',
            required: true,
            description: '任务 ID',
          },
          {
            name: 'status',
            type: 'string',
            required: true,
            description: '任务状态',
            enumValues: [
              { label: '排队中', value: 'pending' },
              { label: '生成中', value: 'running' },
              { label: '已完成', value: 'completed' },
              { label: '失败', value: 'failed' },
            ],
          },
          {
            name: 'progress',
            type: 'number',
            required: true,
            description: '进度百分比（0-100）',
            minValue: 0,
            maxValue: 100,
          },
          {
            name: 'imageUrl',
            type: 'string',
            required: false,
            description: '生成的图片 URL（仅完成后可用）',
          },
          {
            name: 'error',
            type: 'string',
            required: false,
            description: '错误信息（仅失败时可用）',
          },
          {
            name: 'createdAt',
            type: 'string',
            required: true,
            description: '创建时间',
          },
          {
            name: 'completedAt',
            type: 'string',
            required: false,
            description: '完成时间',
          },
          {
            name: 'apiCallLogs',
            type: 'array',
            required: true,
            description: 'API 调用日志（每次第三方请求/响应的完整记录）',
          },
        ],
      },
    };
  }

  async execute(
    context: ApiCallContext,
    authContext: AuthContext
  ): Promise<SyncApiResult<QueryImageTaskOutput>> {
    const input = context.input as QueryImageTaskInput;
    const startTime = Date.now();

    logger.info(`查询图片任务状态`, { taskId: input.taskId });

    try {
      // 从数据库查询任务记录
      const taskRun = await getTaskRunRepository().findById(input.taskId);

      if (!taskRun) {
        logger.warn(`任务不存在`, { taskId: input.taskId });
        return {
          success: false,
          error: {
            code: 'TASK_NOT_FOUND',
            message: '任务不存在或已过期',
          },
          duration: Date.now() - startTime,
        };
      }

      logger.debug(`任务状态`, { taskId: input.taskId, status: taskRun.status, progress: taskRun.progress });

      // 转换状态为接口定义的状态值
      const statusMap: Record<string, QueryImageTaskOutput['status']> = {
        'pending': 'pending',
        'running': 'running',
        'completed': 'completed',
        'failed': 'failed',
      };

      const result: QueryImageTaskOutput = {
        taskId: taskRun.id,
        status: statusMap[taskRun.status] || 'pending',
        progress: taskRun.progress ?? 0,
        imageUrl: taskRun.output?.imageUrl,
        error: taskRun.error?.message,
        apiCallLogs: taskRun.apiCallLogs,
        createdAt: taskRun.createdAt.toISOString(),
        completedAt: taskRun.completedAt?.toISOString(),
      };

      logger.info(`查询成功`, { taskId: input.taskId, status: result.status, duration: Date.now() - startTime });

      return {
        success: true,
        data: result,
        duration: Date.now() - startTime,
      };
    } catch (error: any) {
      logger.error(`查询失败`, error, { taskId: input.taskId });
      return {
        success: false,
        error: {
          code: 'QUERY_FAILED',
          message: error.message || '查询任务失败',
        },
        duration: Date.now() - startTime,
      };
    }
  }
}
