import { BaseApiHandler } from '@core/domain/api/base-api.handler';
import type { ApiCallContext, ApiMetadata, SyncApiResult } from '@core/contracts/api.types';
import type { AuthContext } from '@core/contracts/auth.types';
import { createApiExecutor, createStandardOutputSchema, type StandardApiOutput } from '@core/application/api-executor';

const executor = createApiExecutor('GenerateImage', {
  timeoutMs: 25 * 60 * 1000,
});

/**
 * 图片生成请求参数 (对齐 OpenAI /v1/images/generations)
 */
interface GenerateImageInput {
  /** 用于生成图像的模型 */
  model: string;
  /** 所需图像的文本描述 */
  prompt: string;
  /** 生成图像的尺寸: 1024x1024, 1536x1024(横版), 1024x1536(竖版) */
  size?: string;
  /** 要生成的图像数量 */
  n?: number;
  /** 要编辑的图片URL数组(可选，最多5张) */
  image?: string[];
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
 * 图片生成响应 (对齐 OpenAI /v1/images/generations)
 */
interface GenerateImageOutput {
  /** 创建时间戳 */
  created: number;
  /** 生成的图片数组 */
  data: GeneratedImage[];
}

/**
 * 云雾平台 - 图片生成接口
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
      name: '图片生成',
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
            defaultValue: 'gpt-image-2-all',
            enumValues: [
              { label: 'GPT Image 2 All', value: 'gpt-image-2-all' },
              { label: 'DALL-E 3', value: 'dall-e-3' },
              { label: 'DALL-E 2', value: 'dall-e-2' },
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
            description: '生成图像的尺寸',
            defaultValue: '1024x1024',
            enumValues: [
              { label: '1024x1024 (正方形)', value: '1024x1024' },
              { label: '1536x1024 (横版)', value: '1536x1024' },
              { label: '1024x1536 (竖版)', value: '1024x1536' },
            ],
            uiHint: 'select',
            abilities: [{ name: 'size', group: 'dimension' }],
          },
          {
            name: 'n',
            type: 'number',
            required: false,
            description: '要生成的图像数量',
            defaultValue: 1,
            minValue: 1,
            maxValue: 4,
            abilities: [{ name: 'n' }],
          },
          {
            name: 'image',
            type: 'array',
            required: false,
            description: '要编辑的图片URL数组（可选，最多5张，用于图生图）',
            uiHint: 'image-list',
            abilities: [{ name: 'image' }],
          },
        ],
        // 布局配置：model 和 size 放在一行，n 单独一行，image 独占一行
        layout: {
          rows: [
            { fields: ['model', 'size', 'n'] },
            { fields: ['prompt'] },
            { fields: ['image'] },
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
      n: input.n,
    });

    return executor.execute<GenerateImageInput, GenerateImageOutput, StandardApiOutput>(
      ctx,
      input,
      (input) => {
        const requestBody: Record<string, unknown> = {
          model: input.model,
          prompt: input.prompt,
          size: input.size ?? '1024x1024',
          n: input.n ?? 1,
        };

        if (input.image && input.image.length > 0) {
          requestBody.image = input.image;
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
          if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
            return 'API 返回数据格式无效';
          }
          return true;
        },
        onSuccess: (data) => {
          return {
            content: data.data.map((img) => ({
              type: 'image' as const,
              url: img.url,
              ...(img.revised_prompt ? { metadata: { revised_prompt: img.revised_prompt } } : {}),
            })),
            raw: data,
          };
        },
        errorCode: 'IMAGE_GENERATION_FAILED',
        errorMessage: '图片生成失败',
      }
    );
  }
}
