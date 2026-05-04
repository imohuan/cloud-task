import { BaseApiHandler } from '@core/domain/api/base-api.handler';
import type { ApiCallContext, ApiMetadata, SyncApiResult } from '@core/contracts/api.types';
import type { AuthContext } from '@core/contracts/auth.types';
import { createApiExecutor, createStandardOutputSchema, type StandardApiOutput } from '@core/application/api-executor';
import type { PollingConfig, PollingState } from '@core/domain/api/base-api.handler';
import { ensureImageProxyUrls } from '@utils/ensure-image-proxy';

const executor = createApiExecutor('GenerateImage', {
  timeoutMs: 25 * 60 * 1000,
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
  image_urls?: string[];
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
 * 图片生成提交响应（异步任务提交后返回 task_id）
 */
interface GenerateImageSubmitOutput {
  /** 任务唯一标识符，用于后续查询任务结果 */
  task_id: string;
  /** 任务状态：submitted */
  status: string;
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
            abilities: [{ name: 'size', group: 'dimension' }],
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
              { label: '4k (仅支持 16:9 / 9:16 / 2:1 / 1:2 / 21:9 / 9:21)', value: '4k' },
            ],
            uiHint: 'select',
          },
          {
            name: 'image_urls',
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
            { fields: ['image_urls'] },
            { fields: ['official_fallback'] },
          ],
          fieldConfig: {
            prompt: { colSpan: 1 },
            image_urls: { colSpan: 1 },
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

        if (input.image_urls && input.image_urls.length > 0) {
          requestBody.image_urls = input.image_urls; // 已由 onBeforeRequest 转存为代理 URL
          logger.debug(`[${ctx.taskRunId}] 包含参考图片`, {
            imageCount: input.image_urls.length,
          });
        }

        return {
          path: '/images/generations',
          body: requestBody,
        };
      },
      {
        validateResponse: (data) => {
          if (!data.task_id) return 'API 未返回任务ID';
          return true;
        },
        onSuccess: (data) => {
          logger.info(`[${ctx.taskRunId}] 图片任务提交成功，第三方任务ID: ${data.task_id}`);
          return {
            content: [],
            raw: data,
            _polling: {
              thirdPartyTaskId: data.task_id,
              pollingPhase: 'image_generate',
            },
          };
        },
        errorCode: 'IMAGE_GENERATION_FAILED',
        errorMessage: '图片生成失败',

        // 图生图模式下，base64 data URI 不需要代理转存，仅对 http(s) URL 处理
        // onBeforeRequest: async (input, ctx) => {
        //   if (input.image_urls && input.image_urls.length > 0) {
        //     const httpUrls = input.image_urls.filter((u) => /^https?:\/\//.test(u));
        //     if (httpUrls.length > 0) {
        //       logger.debug(`[${ctx.taskRunId}] 转存参考图片到代理域名`, { count: httpUrls.length });
        //       const proxied = await ensureImageProxyUrls(httpUrls);
        //       let pi = 0;
        //       input.image_urls = input.image_urls.map((u) =>
        //         /^https?:\/\//.test(u) ? proxied[pi++] : u
        //       );
        //     }
        //   }
        // },
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

    logger.info(`[${ctx.taskRunId}] 轮询图片任务状态`, { thirdPartyTaskId });

    try {
      const response = await executor.request<{ code: number; data: ImageTaskQueryOutput }>(ctx, {
        path: `/tasks/${thirdPartyTaskId}`,
        method: 'GET',
      });

      const task = response.data;
      logger.debug(`[${ctx.taskRunId}] 轮询结果`, { status: task.status, progress: task.progress });

      const duration = Date.now() - ctx.startTime;

      if (task.status === 'completed') {
        const imageUrl = task.result?.images?.[0]?.url?.[0];
        if (!imageUrl) {
          return {
            success: false,
            error: { code: 'IMAGE_RESULT_MISSING', message: '任务完成但未返回图片URL' },
            duration,
          };
        }
        logger.info(`[${ctx.taskRunId}] 图片生成完成`, { imageUrl });
        return {
          success: true,
          data: {
            content: [{ type: 'image', url: imageUrl }],
            raw: task,
          },
          duration,
        };
      }

      if (task.status === 'failed') {
        const msg = task.error?.message || '第三方图片生成任务失败';
        logger.warn(`[${ctx.taskRunId}] 第三方任务失败`, { msg });
        return {
          success: false,
          error: { code: 'THIRD_PARTY_FAILED', message: msg },
          duration,
        };
      }

      // submitted / processing — 继续轮询
      logger.info(`[${ctx.taskRunId}] 图片仍在处理中，继续轮询`, { status: task.status });
      return {
        success: true,
        data: {
          content: [],
          _continuePolling: true,
          raw: task,
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
