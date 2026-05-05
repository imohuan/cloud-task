import { BaseApiHandler } from '@core/domain/api/base-api.handler';
import type { ApiCallContext, ApiMetadata, SyncApiResult } from '@core/contracts/api.types';
import type { AuthContext } from '@core/contracts/auth.types';
import { createApiExecutor, createStandardOutputSchema, type StandardApiOutput } from '@core/application/api-executor';
import type { PollingConfig, PollingState } from '@core/domain/api/base-api.handler';
import { ensureImageProxyUrls } from '@utils/ensure-image-proxy';

const executor = createApiExecutor('GrokGenerateVideo');

// ========== 类型定义 ==========

interface GrokGenerateVideoInput {
  model?: string;
  prompt: string;
  aspect_ratio?: string;
  size?: string;
  images?: string[];
}

interface VideoCreateOutput {
  id: string;
  status: string;
  status_update_time: number;
}

interface VideoQueryOutput {
  id: string;
  status: string;
  video_url?: string;
  enhanced_prompt?: string;
  status_update_time: number;
}

// ========== Handler ==========

export class GrokGenerateVideoApiHandler extends BaseApiHandler<GrokGenerateVideoInput, StandardApiOutput> {
  getMetadata(): ApiMetadata {
    return {
      id: 'grok-video',
      name: 'Grok 视频生成',
      description: '根据文本描述或图片生成视频（支持 grok-video-3 模型），需要后台轮询获取结果',
      authStrategyId: 'api-key',
      executionMode: 'async',
      enabled: true,
      version: '1.0.0',
      tags: ['video', 'generation', 'ai', 'grok', 'polling'],
      inputSchema: {
        description: 'Grok 视频生成参数',
        fields: [
          {
            name: 'model',
            type: 'string',
            required: false,
            description: '用于生成视频的模型',
            defaultValue: 'grok-video-3',
            enumValues: [
              { label: 'Grok Video 3', value: 'grok-video-3' },
            ],
            uiHint: 'select',
            abilities: [{ name: 'model' }],
          },
          {
            name: 'prompt',
            type: 'string',
            required: true,
            description: '视频描述文本，最大长度 4000 字符',
            minLength: 1,
            maxLength: 4000,
            uiHint: 'textarea',
            abilities: [{ name: 'prompt' }],
          },
          {
            name: 'aspect_ratio',
            type: 'string',
            required: false,
            description: '视频宽高比',
            defaultValue: '3:2',
            enumValues: [
              { label: '3:2', value: '3:2' },
              { label: '2:3', value: '2:3' },
              { label: '1:1', value: '1:1' },
            ],
            uiHint: 'select',
            abilities: [{ name: 'aspect_ratio', group: 'dimension' }],
          },
          {
            name: 'size',
            type: 'string',
            required: false,
            description: '视频分辨率',
            defaultValue: '720P',
            enumValues: [
              { label: '720P', value: '720P' },
              { label: '1080P', value: '1080P' },
            ],
            uiHint: 'select',
            abilities: [{ name: 'size', group: 'dimension' }],
          },
          {
            name: 'images',
            type: 'array',
            required: false,
            description: '参考图片 URL 数组（可选，用于图生视频）',
            uiHint: 'image-list',
            abilities: [{ name: 'image' }],
          },
        ],
        layout: {
          rows: [
            { fields: ['model', 'aspect_ratio', 'size'] },
            { fields: ['prompt'] },
            { fields: ['images'] },
          ],
          fieldConfig: {
            prompt: { colSpan: 1 },
            images: { colSpan: 1 },
          },
        },
      },
      outputSchema: createStandardOutputSchema('Grok 视频生成标准化输出', [
        { name: 'id', type: 'string', required: true, description: '第三方任务ID' },
        { name: 'status', type: 'string', required: true, description: '任务状态' },
        { name: 'video_url', type: 'string', required: false, description: '生成的视频URL（完成后可用）' },
      ]),
    };
  }

  getPollingConfig(): PollingConfig {
    return {
      intervalMs: 15000,
      maxPollCount: 480,
      backoffStrategy: 'exponential',
      backoffMultiplier: 1.3,
      maxIntervalMs: 300000,
    };
  }

  async execute(
    context: ApiCallContext,
    authContext: AuthContext
  ): Promise<SyncApiResult<StandardApiOutput>> {
    const input = context.input as GrokGenerateVideoInput;
    const ctx = executor.createContext(context, authContext);
    const { logger } = executor;

    logger.info(`[${ctx.taskRunId}] 开始 Grok 视频创建任务`, {
      model: input.model,
      prompt: input.prompt,
    });

    return executor.execute<GrokGenerateVideoInput, VideoCreateOutput, StandardApiOutput>(
      ctx,
      input,
      (input) => {
        const body: Record<string, unknown> = {
          model: input.model ?? 'grok-video-3',
          prompt: input.prompt,
        };
        if (input.aspect_ratio) body.aspect_ratio = input.aspect_ratio;
        if (input.size) body.size = input.size;
        if (input.images && input.images.length > 0) body.images = input.images;

        return {
          path: '/video/create',
          body,
        };
      },
      {
        onBeforeRequest: async (input, ctx) => {
          if (input.images && input.images.length > 0) {
            logger.debug(`[${ctx.taskRunId}] 转存参考图片到代理域名`, { count: input.images.length });
            input.images = await ensureImageProxyUrls(input.images);
          }
        },
        validateResponse: (data) => {
          if (!data.id) return 'API 未返回任务ID';
          return true;
        },
        onSuccess: (data) => {
          logger.info(`[${ctx.taskRunId}] 视频创建成功，第三方任务ID: ${data.id}`);
          return {
            content: [],
            raw: data,
            _polling: {
              thirdPartyTaskId: data.id,
              pollingPhase: 'video_create',
            },
          };
        },
        errorCode: 'VIDEO_CREATE_FAILED',
        errorMessage: '视频创建失败',
      }
    );
  }

  async poll(
    context: ApiCallContext,
    authContext: AuthContext,
    pollingState: PollingState
  ): Promise<SyncApiResult<StandardApiOutput>> {
    const ctx = executor.createContext(context, authContext);
    const { logger } = executor;
    const { thirdPartyTaskId } = pollingState;

    logger.info(`[${ctx.taskRunId}] 轮询视频任务状态`, { thirdPartyTaskId });

    try {
      const response = await executor.request<VideoQueryOutput>(ctx, {
        path: `/video/query?id=${thirdPartyTaskId}`,
        method: 'GET',
      }, "poll-call");

      logger.debug(`[${ctx.taskRunId}] 轮询结果`, { status: response.status });

      const duration = Date.now() - ctx.startTime;

      // 第三方已完成
      if (response.status === 'completed' && response.video_url) {
        logger.info(`[${ctx.taskRunId}] 视频生成完成`, { videoUrl: response.video_url });
        return {
          success: true,
          data: {
            content: [{ type: 'video', url: response.video_url }],
            raw: response,
          },
          duration,
        };
      }

      // 第三方失败
      if (response.status === 'failed') {
        logger.warn(`[${ctx.taskRunId}] 第三方任务失败`);
        return {
          success: false,
          error: {
            code: 'THIRD_PARTY_FAILED',
            message: '第三方视频生成任务失败',
          },
          duration,
        };
      }

      // 仍在处理中，继续轮询
      logger.info(`[${ctx.taskRunId}] 视频仍在处理中，继续轮询`, { status: response.status });
      return {
        success: true,
        data: {
          content: [],
          _continuePolling: true,
          raw: response,
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
