import { BaseApiHandler } from '@core/domain/api/base-api.handler';
import type { ApiCallContext, ApiMetadata, SyncApiResult } from '@core/contracts/api.types';
import type { AuthContext } from '@core/contracts/auth.types';
import { createApiExecutor, createStandardOutputSchema, calcTimeBasedProgress, type StandardApiOutput } from '@core/application/api-executor';
import type { PollingConfig, PollingState } from '@core/domain/api/base-api.handler';
import { isLocalOrPrivateUrl } from '@utils/is-local-url';
import { resolveImageMime } from '@utils/detect-image-mime';
import { ensureImageProxyUrl } from '@utils/ensure-image-proxy';
import { getTaskRunRepository } from '@adapters/persistence';

const executor = createApiExecutor('GenerateImage', {
  timeoutMs: 25 * 60 * 1000,
  startProgress: 10,
  completeProgress: 20,
  // submit 阶段预计 10s，模拟进度从 startProgress 递增至 simulateTo
  estimatedRequestMs: 10_000,
  // 上限设为 25，低于 polling 入口的 30%，防止回退
  simulateTo: 25,
});

/**
 * 图片生成请求参数
 */
interface GenerateImageInput {
  /** 用于生成图像的模型 */
  model: string;
  /** 所需图像的文本描述 */
  prompt: string;
  /** 图像生成比例，默认 1:1，支持 auto / 1:1 / 3:2 / 2:3 / 4:3 / 3:4 / 5:4 / 4:5 / 16:9 / 9:16 / 2:1 / 1:2 / 21:9 / 9:21 */
  size?: string;
  /** 生成图片张数，默认 1，取值范围：1 */
  n?: number;
  /** 输出分辨率档位：1k / 2k / 4k，默认 1k */
  resolution?: string;
  /** 参考图数组，传入后走图生图模式，最多 16 张，支持 URL 或 base64 data URI */
  image?: string[];
  /** 是否使用官方渠道兜底，默认 false */
  official_fallback?: boolean;
}

/**
 * 单张生成的图片数据
 */
interface GeneratedImage {
  /** 优化后的提示词 */
  revised_prompt?: string;
  /** 生成的图片URL */
  url: string;
}

/**
 * 提交响应中单个任务项
 */
interface SubmittedTask {
  /** 任务唯一标识符，用于后续查询任务结果 */
  task_id: string;
  /** 任务状态：submitted */
  status: string;
}

/**
 * 图片生成提交响应
 *
 * API 返回形如：
 * { code: 200, data: [{ task_id, status }, ...] }
 *
 * 当 n > 1 时 data 会含多个任务项。
 */
interface GenerateImageSubmitOutput {
  code: number;
  data: SubmittedTask[];
}

/**
 * 图片任务查询响应
 */
interface ImageTaskQueryOutput {
  id: string;
  status: string;
  progress?: number;
  created?: number;
  completed?: number;
  actual_time?: number;
  estimated_time?: number;
  result?: {
    images: Array<{
      url: string[];
      expires_at?: number;
    }>;
  };
  error?: {
    message?: string;
  };
}

/**
 * Apimart平台 - 图片生成接口
 *
 * 说明：
 * - 该 handler 的 execute 负责真正的业务执行逻辑
 * - 异步入队/状态流转由通用任务系统处理
 * - 用户通过 query-image-task 查询进度与结果
 */
export class GenerateImageApiHandler extends BaseApiHandler<GenerateImageInput, StandardApiOutput> {
  getMetadata(): ApiMetadata {
    return {
      id: 'generate',
      name: 'GPT Image 2 图片生成',
      description: '根据文本描述生成图片（支持 gpt-image-2-all 等模型）',
      authStrategyId: 'api-key',
      executionMode: 'async',
      enabled: true,
      version: '2.0.0',
      tags: ['image', 'generation', 'ai', 'openai'],
      inputSchema: {
        description: '图片生成参数 (对齐 OpenAI Images API)',
        fields: [
          {
            name: 'model',
            type: 'string',
            required: true,
            description: '用于生成图像的模型',
            defaultValue: 'gpt-image-2',
            enumValues: [
              { label: 'GPT Image 2', value: 'gpt-image-2' },
            ],
            uiHint: 'select',
          },
          {
            name: 'prompt',
            type: 'string',
            required: true,
            description: '所需图像的文本描述',
            minLength: 1,
            maxLength: 4000,
            uiHint: 'textarea',
            abilities: [{ name: 'prompt' }],
          },
          {
            name: 'size',
            type: 'string',
            required: false,
            description: '图像生成比例，默认 1:1',
            defaultValue: '1:1',
            enumValues: [
              { label: 'auto (自动)', value: 'auto' },
              { label: '1:1 (正方)', value: '1:1' },
              { label: '3:2 (横图)', value: '3:2' },
              { label: '2:3 (竖图)', value: '2:3' },
              { label: '4:3 (横图)', value: '4:3' },
              { label: '3:4 (竖图)', value: '3:4' },
              { label: '5:4 (横图)', value: '5:4' },
              { label: '4:5 (竖图)', value: '4:5' },
              { label: '16:9 (横图)', value: '16:9' },
              { label: '9:16 (竖图)', value: '9:16' },
              { label: '2:1 (横图)', value: '2:1' },
              { label: '1:2 (竖图)', value: '1:2' },
              { label: '21:9 (横图)', value: '21:9' },
              { label: '9:21 (竖图)', value: '9:21' },
            ],
            uiHint: 'select',
            abilities: [{ name: 'aspect_ratio', group: 'dimension' }],
          },
          {
            name: 'n',
            type: 'number',
            required: false,
            description: '生成图片张数，默认 1，取值范围：1',
            defaultValue: 1,
            minValue: 1,
            maxValue: 1,
            abilities: [{ name: 'n' }],
          },
          {
            name: 'resolution',
            type: 'string',
            required: false,
            description: '输出分辨率档位，默认 1k',
            defaultValue: '1k',
            enumValues: [
              { label: '1k', value: '1k' },
              { label: '2k', value: '2k' },
              { label: '4k', value: '4k', description: '仅支持 16:9 / 9:16 / 2:1 / 1:2 / 21:9 / 9:21', enabledWhen: { field: 'size', values: ['16:9', '9:16', '2:1', '1:2', '21:9', '9:21'] } },
            ],
            uiHint: 'select',
            abilities: [{ name: 'size', group: 'dimension' }],
          },
          {
            name: 'image',
            type: 'array',
            required: false,
            description: '参考图数组，传入后走图生图模式，最多 16 张，支持 URL 或 base64 data URI',
            uiHint: 'image-list',
            abilities: [{ name: 'image' }],
          },
          {
            name: 'official_fallback',
            type: 'boolean',
            required: false,
            description: '是否使用官方渠道兜底，默认 false',
            defaultValue: false,
          },
        ],
        layout: {
          rows: [
            { fields: ['model', 'size'] },
            { fields: ['resolution', 'n'] },
            { fields: ['prompt'] },
            { fields: ['image'] },
            { fields: ['official_fallback'] },
          ],
          fieldConfig: {
            prompt: { colSpan: 1 },
            image: { colSpan: 1 },
          },
        },
      },
      outputSchema: createStandardOutputSchema('图片生成标准化输出', [
        { name: 'created', type: 'number', required: true, description: '创建时间戳' },
        {
          name: 'data',
          type: 'array',
          required: true,
          description: '生成的图片数组',
          fields: [
            { name: 'revised_prompt', type: 'string', required: false, description: '优化后的提示词' },
            { name: 'url', type: 'string', required: true, description: '生成的图片URL' },
          ],
        },
      ]),
    };
  }

  async execute(
    context: ApiCallContext,
    authContext: AuthContext
  ): Promise<SyncApiResult<StandardApiOutput>> {
    const input = context.input as GenerateImageInput;
    const ctx = executor.createContext(context, authContext);
    const { logger } = executor;

    logger.info(`[${ctx.taskRunId}] 开始图片生成任务`, {
      model: input.model,
      prompt: input.prompt,
      size: input.size,
      resolution: input.resolution,
    });

    return executor.execute<GenerateImageInput, GenerateImageSubmitOutput, StandardApiOutput>(
      ctx,
      input,
      (input) => {
        const requestBody: Record<string, unknown> = {
          model: input.model,
          prompt: input.prompt,
          size: input.size ?? '1:1',
          resolution: input.resolution ?? '1k',
          n: input.n ?? 1,
        };

        if (input.official_fallback) {
          requestBody.official_fallback = true;
        }

        if (input.image && input.image.length > 0) {
          requestBody.image_urls = input.image; // 已由 onBeforeRequest 转存为代理 URL
          logger.debug(`[${ctx.taskRunId}] 包含参考图片`, {
            imageCount: input.image.length,
          });
        }

        return {
          path: '/images/generations',
          body: requestBody,
        };
      },
      {
        validateResponse: (data) => {
          if (!Array.isArray(data?.data) || data.data.length === 0) {
            return 'API 未返回任务列表';
          }
          if (!data.data[0]?.task_id) return 'API 未返回任务ID';
          return true;
        },
        onSuccess: (data) => {
          const tasks = data.data;
          const taskIds = tasks.map((t) => t.task_id);
          logger.info(`[${ctx.taskRunId}] 图片任务提交成功`, {
            count: tasks.length,
            taskIds,
          });
          return {
            content: [],
            raw: data,
            _polling: {
              // 多任务时以 ',' 拼接，poll() 会按 ',' 拆分后并发查询
              thirdPartyTaskId: taskIds.join(','),
              pollingPhase: 'image_generate',
            },
          };
        },
        errorCode: 'IMAGE_GENERATION_FAILED',
        errorMessage: '图片生成失败',

        onBeforeRequest: async (input, ctx) => {
          if (input.image && input.image.length > 0) {
            const httpUrls = input.image.filter((u) => /^https?:\/\//.test(u) && isLocalOrPrivateUrl(u));
            if (httpUrls.length > 0) {
              logger.debug(`[${ctx.taskRunId}] 检测到本地/私有网络图片，尝试使用代理中转`, { count: httpUrls.length });
              const resultMap = new Map<string, string>();
              await Promise.all(
                httpUrls.map(async (url) => {
                  try {
                    const proxyUrl = await ensureImageProxyUrl(url);
                    resultMap.set(url, proxyUrl);
                    logger.debug(`[${ctx.taskRunId}] 图片代理中转成功`, { url, proxyUrl });
                  } catch (proxyErr) {
                    logger.warn(`[${ctx.taskRunId}] 代理中转失败，回退 base64`, { url, error: String(proxyErr) });
                    const { buffer, contentType } = await executor.downloadBuffer(url);
                    const mime = resolveImageMime(buffer, contentType);
                    resultMap.set(url, `data:${mime};base64,${buffer.toString('base64')}`);
                  }
                })
              );
              input.image = input.image.map((u) => resultMap.get(u) ?? u);
            }
          }
        },
      }
    );
  }

  getPollingConfig(): PollingConfig {
    return {
      intervalMs: 5000,
      maxPollCount: 240,
      backoffStrategy: 'fixed',
      backoffMultiplier: 1,
      maxIntervalMs: 5000,
    };
  }

  async poll(
    context: ApiCallContext,
    authContext: AuthContext,
    pollingState: PollingState
  ): Promise<SyncApiResult<StandardApiOutput>> {
    const ctx = executor.createContext(context, authContext);
    const { logger } = executor;
    const { thirdPartyTaskId } = pollingState;
    const taskIds = String(thirdPartyTaskId || '').split(',').map((s) => s.trim()).filter(Boolean);

    if (taskIds.length === 0) {
      return {
        success: false,
        error: { code: 'POLL_INVALID_STATE', message: '轮询状态缺少 task_id' },
        duration: Date.now() - ctx.startTime,
      };
    }

    // 已进入终态（completed/failed）的任务结果缓存：避免重复请求
    const taskCache: Record<string, ImageTaskQueryOutput> =
      (pollingState.taskCache as Record<string, ImageTaskQueryOutput>) ?? {};
    const idsToFetch = taskIds.filter((id) => !taskCache[id]);

    logger.info(`[${ctx.taskRunId}] 轮询图片任务状态`, {
      total: taskIds.length,
      cached: taskIds.length - idsToFetch.length,
      toFetch: idsToFetch.length,
    });

    try {
      // 仅对未缓存的任务发起并发请求
      const fetched = idsToFetch.length > 0
        ? await Promise.all(
            idsToFetch.map(async (id) => {
              const response = await executor.request<{ code: number; data: ImageTaskQueryOutput }>(ctx, {
                path: `/tasks/${id}`,
                method: 'GET',
              });
              return { id, task: response.data };
            })
          )
        : [];

      // 合并：按提交顺序，缓存优先、新结果回填
      const fetchedById = new Map(fetched.map((f) => [f.id, f.task]));
      const tasks = taskIds.map((id) => ({
        id,
        task: (taskCache[id] ?? fetchedById.get(id)) as ImageTaskQueryOutput,
      }));

      // 把本次新拿到的终态任务加入缓存
      const newCache: Record<string, ImageTaskQueryOutput> = { ...taskCache };
      for (const { id, task } of fetched) {
        if (task.status === 'completed' || task.status === 'failed') {
          newCache[id] = task;
        }
      }

      const duration = Date.now() - ctx.startTime;

      // 按提交顺序构建 content（使用稀疏数组保留位置，最后过滤 null）
      type ImageContent = { type: 'image'; url: string };
      const contentByIndex: Array<ImageContent | null> = new Array(tasks.length).fill(null);
      const failures: string[] = [];
      let anyInProgress = false;
      let progressSum = 0;
      let progressSamples = 0;

      for (let i = 0; i < tasks.length; i++) {
        const { id, task } = tasks[i];
        if (task.status === 'completed') {
          const url = task.result?.images?.[0]?.url?.[0];
          if (url) {
            contentByIndex[i] = { type: 'image', url };
          } else {
            failures.push(`任务 ${id} 完成但未返回图片URL`);
          }
        } else if (task.status === 'failed') {
          failures.push(`任务 ${id} 失败: ${task.error?.message ?? '未知错误'}`);
        } else {
          anyInProgress = true;
          if (typeof task.progress === 'number') {
            progressSum += task.progress;
            progressSamples++;
          }
        }
      }

      const partialContent = contentByIndex.filter((c): c is ImageContent => c !== null);
      const completedCount = partialContent.length;

      // 还有进行中的任务：先计算进度，再推送阶段性结果，然后继续轮询
      if (anyInProgress) {
        // ── 进度计算（需在 updateStatus 之前完成）──────────────────────────────
        // 第三方综合进度：已完成记 100%，进行中按平均 progress 加权
        const avgInProgress = progressSamples > 0 ? progressSum / progressSamples : 0;
        const thirdPartyProgress = Math.floor(
          ((completedCount * 100) + (taskIds.length - completedCount) * avgInProgress) / taskIds.length
        );

        // 模拟进度：按已耗时在 [30, 90] 线性插值
        // pollingStartedAt 由 task.route.ts 进入 polling 时写入
        const pollingStartedAt: number =
          (pollingState.pollingStartedAt as number | undefined) ?? Date.now();
        // 从本次 API 响应中取最大 estimated_time（秒）以改善估算
        const maxEstimatedSec = fetched.reduce(
          (max, f) => Math.max(max, f.task.estimated_time ?? 0), 0
        );
        const estimatedPollingMs: number = maxEstimatedSec > 0
          ? Math.max((pollingState.estimatedPollingMs as number | undefined) ?? 0, maxEstimatedSec * 1000)
          : ((pollingState.estimatedPollingMs as number | undefined) ?? 120_000);
        const simulatedProgress = calcTimeBasedProgress(pollingStartedAt, estimatedPollingMs, 30, 90);
        // 取两者较大值，保证单调递增且不低于模拟应有进度
        const overallProgress = Math.max(thirdPartyProgress, simulatedProgress);

        // ── 推送阶段性结果到 DB ────────────────────────────────────────────────
        if (ctx.taskRunId) {
          try {
            const repo = getTaskRunRepository();
            const fresh = await repo.findById(ctx.taskRunId);
            const baseOutput = (fresh?.output as Record<string, unknown>) ?? {};
            await repo.updateStatus(ctx.taskRunId, 'polling', {
              output: {
                ...baseOutput,
                content: partialContent,
                // 持久化终态任务缓存，下次 poll 可跳过这些 id
                taskCache: newCache,
                // 持久化预计耗时，下次 poll 可直接读取避免重置
                estimatedPollingMs,
              },
            });
            logger.info(`[${ctx.taskRunId}] 已推送阶段性结果`, {
              completed: completedCount,
              cachedTotal: Object.keys(newCache).length,
              total: taskIds.length,
            });
          } catch (e) {
            logger.warn(`[${ctx.taskRunId}] 推送阶段性结果失败`, { error: String(e) });
          }
        }

        logger.info(`[${ctx.taskRunId}] 仍在处理中，继续轮询`, {
          completed: completedCount,
          total: taskIds.length,
          thirdPartyProgress,
          simulatedProgress,
          overallProgress,
          estimatedPollingMs,
        });

        return {
          success: true,
          data: {
            content: partialContent,
            _continuePolling: true,
            _progress: overallProgress,
            raw: { tasks: tasks.map((t) => t.task), partialContent, failures },
          },
          duration,
        };
      }

      // 所有任务都已结束（completed/failed 组合）
      if (completedCount === 0) {
        return {
          success: false,
          error: {
            code: 'IMAGE_GENERATION_ALL_FAILED',
            message: failures.join('; ') || '所有图片任务均失败',
          },
          duration,
        };
      }

      logger.info(`[${ctx.taskRunId}] 全部图片任务结束`, {
        completed: completedCount,
        failed: failures.length,
        total: taskIds.length,
      });

      return {
        success: true,
        data: {
          content: partialContent,
          raw: { tasks: tasks.map((t) => t.task), failures },
        },
        duration,
      };
    } catch (error: any) {
      const duration = Date.now() - ctx.startTime;
      logger.error(`[${ctx.taskRunId}] 轮询请求失败`, error);
      return {
        success: false,
        error: {
          code: 'POLL_REQUEST_FAILED',
          message: error.message || '轮询请求失败',
        },
        duration,
      };
    }
  }
}
