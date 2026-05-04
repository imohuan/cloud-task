import { BaseApiHandler } from '@core/domain/api/base-api.handler';
import type { ApiCallContext, ApiMetadata, SyncApiResult } from '@core/contracts/api.types';
import type { AuthContext } from '@core/contracts/auth.types';
import { createApiExecutor, createStandardOutputSchema, type StandardApiOutput } from '@core/application/api-executor';

const executor = createApiExecutor('GrokGenerateImage');

/**
 * Grok 图片生成请求参数
 */
interface GrokGenerateImageInput {
  /** 用于生成图像的模型 */
  model: string;
  /** 所需图像的文本描述，最大长度 1000 个字符 */
  prompt: string;
  /** 生成图像的尺寸: 960x960, 720x1280, 1280x720, 1168x784, 784x1168 */
  size?: string;
}

/**
 * 单张生成的图片数据
 */
interface GeneratedImage {
  /** 生成的图片URL */
  url: string;
}

/**
 * 用量统计
 */
interface UsageInfo {
  /** 生成的图片数量 */
  generated_images: number;
  /** 输出 token 数 */
  output_tokens: number;
  /** 总 token 数 */
  total_tokens: number;
}

/**
 * Grok 图片生成响应
 */
interface GrokGenerateImageOutput {
  /** 创建时间戳 */
  created: number;
  /** 生成的图片数组 */
  data: GeneratedImage[];
  /** 用量统计 */
  usage: UsageInfo;
}

/**
 * NewAPI平台 - Grok 图片生成接口
 *
 * 说明：
 * - 该 handler 的 execute 负责真正的业务执行逻辑
 * - 异步入队/状态流转由通用任务系统处理
 * - 用户通过 query-image-task 查询进度与结果
 */
export class GrokGenerateImageApiHandler extends BaseApiHandler<GrokGenerateImageInput, StandardApiOutput> {
  getMetadata(): ApiMetadata {
    return {
      id: 'grok-generate',
      name: 'Grok 图片生成',
      description: '根据文本描述生成图片（支持 grok-3-image 模型）',
      authStrategyId: 'api-key',
      executionMode: 'async',
      enabled: true,
      version: '1.0.0',
      tags: ['image', 'generation', 'ai', 'grok'],
      inputSchema: {
        description: 'Grok 图片生成参数',
        fields: [
          {
            name: 'model',
            type: 'string',
            required: true,
            description: '用于生成图像的模型',
            defaultValue: 'grok-3-image',
            enumValues: [
              { label: 'Grok 3 Image', value: 'grok-3-image' },
              { label: 'Grok 4.2 Image', value: 'grok-4.2-image' },
            ],
            uiHint: 'select',
            abilities: [{ name: 'model' }],
          },
          {
            name: 'prompt',
            type: 'string',
            required: true,
            description: '所需图像的文本描述，最大长度 1000 个字符',
            minLength: 1,
            maxLength: 1000,
            uiHint: 'textarea',
            abilities: [{ name: 'prompt' }],
          },
          {
            name: 'size',
            type: 'string',
            required: false,
            description: '生成图像的尺寸',
            defaultValue: '960x960',
            enumValues: [
              { label: '960x960 (正方形)', value: '960x960' },
              { label: '1280x720 (横版)', value: '1280x720' },
              { label: '720x1280 (竖版)', value: '720x1280' },
              { label: '1168x784 (横版)', value: '1168x784' },
              { label: '784x1168 (竖版)', value: '784x1168' },
            ],
            uiHint: 'select',
            abilities: [{ name: 'size', group: 'dimension' }],
          },
        ],
        layout: {
          rows: [
            { fields: ['model', 'size'] },
            { fields: ['prompt'] },
          ],
          fieldConfig: {
            prompt: { colSpan: 1 },
          },
        },
      },
      outputSchema: createStandardOutputSchema('Grok 图片生成标准化输出', [
        { name: 'created', type: 'number', required: true, description: '创建时间戳' },
        {
          name: 'data',
          type: 'array',
          required: true,
          description: '生成的图片数组',
          fields: [
            { name: 'url', type: 'string', required: true, description: '生成的图片URL' },
          ],
        },
        {
          name: 'usage',
          type: 'object',
          required: true,
          description: '用量统计',
          fields: [
            { name: 'generated_images', type: 'number', required: true, description: '生成的图片数量' },
            { name: 'output_tokens', type: 'number', required: true, description: '输出 token 数' },
            { name: 'total_tokens', type: 'number', required: true, description: '总 token 数' },
          ],
        },
      ]),
    };
  }

  async execute(
    context: ApiCallContext,
    authContext: AuthContext
  ): Promise<SyncApiResult<StandardApiOutput>> {
    const input = context.input as GrokGenerateImageInput;
    const ctx = executor.createContext(context, authContext);
    const { logger } = executor;

    logger.info(`[${ctx.taskRunId}] 开始 Grok 图片生成任务`, {
      model: input.model,
      prompt: input.prompt,
      size: input.size,
    });

    return executor.execute<GrokGenerateImageInput, GrokGenerateImageOutput, StandardApiOutput>(
      ctx,
      input,
      (input) => ({
        path: '/images/generations',
        body: {
          model: input.model,
          prompt: input.prompt,
          size: input.size ?? '960x960',
        },
      }),
      {
        validateResponse: (data) => {
          if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
            return 'API 返回数据格式无效';
          }
          if (!data.usage || typeof data.usage !== 'object') {
            return 'API 返回用量数据格式无效';
          }
          return true;
        },
        onSuccess: (data) => {
          return {
            content: data.data.map((img) => ({
              type: 'image' as const,
              url: img.url,
            })),
            raw: data,
          };
        },
        errorCode: 'GROK_IMAGE_GENERATION_FAILED',
        errorMessage: 'Grok 图片生成失败',
      }
    );
  }
}
