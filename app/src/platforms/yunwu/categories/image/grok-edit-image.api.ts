import { BaseApiHandler } from '@core/domain/api/base-api.handler';
import type { ApiCallContext, ApiMetadata, SyncApiResult } from '@core/contracts/api.types';
import type { AuthContext } from '@core/contracts/auth.types';
import { createApiExecutor, createStandardOutputSchema, type StandardApiOutput } from '@core/application/api-executor';

const executor = createApiExecutor('GrokEditImage');

/**
 * Grok 图片编辑请求参数
 */
interface GrokEditImageInput {
  /** 用于编辑图像的模型 */
  model: string;
  /** 编辑图片的提示词 */
  prompt: string;
  /** 要编辑的图片 URL 数组（取第一张，系统内部 /api/upload/{hash} 或外部 https URL） */
  image: string[];
  /** 【可选】宽高比 */
  aspect_ratio?: string;
  /** 【可选】输出格式: b64_json 或 url */
  response_format?: string;
  /** 【可选】分辨率: "1k" | "2k" */
  resolution?: string;
  /** 【可选】质量: "low" | "medium" | "high" */
  quality?: string;
  /** 【可选】输出图片数量，默认 1，最大 10 */
  n?: number;
}

/**
 * 单张图片数据
 */
interface EditedImage {
  url?: string;
  b64_json?: string;
}

/**
 * 用量统计
 */
interface UsageInfo {
  generated_images: number;
  output_tokens: number;
  total_tokens: number;
}

/**
 * Grok 图片编辑响应
 */
interface GrokEditImageOutput {
  created: number;
  data: EditedImage[];
  usage: UsageInfo;
}

/**
 * 云雾平台 - Grok 图片编辑接口
 *
 * 说明：
 * - 接收图片 URL，下载后以 multipart/form-data 发送到 /images/edits
 * - 同步返回编辑后的图片 URL
 */
export class GrokEditImageApiHandler extends BaseApiHandler<GrokEditImageInput, StandardApiOutput> {
  getMetadata(): ApiMetadata {
    return {
      id: 'grok-edit',
      name: 'Grok 图片编辑',
      description: '基于提示词编辑已有图片（支持 grok-3-image 模型）',
      authStrategyId: 'api-key',
      executionMode: 'async',
      enabled: true,
      version: '1.0.0',
      tags: ['image', 'edit', 'ai', 'grok'],
      inputSchema: {
        description: 'Grok 图片编辑参数',
        fields: [
          {
            name: 'model',
            type: 'string',
            required: true,
            description: '用于编辑图像的模型',
            defaultValue: 'grok-3-image',
            enumValues: [
              { label: 'Grok 3 Image Edit', value: 'grok-3-image' },
            ],
            uiHint: 'select',
            abilities: [{ name: 'model' }],
          },
          {
            name: 'prompt',
            type: 'string',
            required: true,
            description: '编辑图片的提示词',
            minLength: 1,
            uiHint: 'textarea',
            abilities: [{ name: 'prompt' }],
          },
          {
            name: 'image',
            type: 'array',
            required: true,
            description: '要编辑的图片（支持传入 1 张）',
            uiHint: 'image-list',
            maxImageLength: 1,
            localUploadOnly: true,
            abilities: [{ name: 'image' }],
          },
          {
            name: 'aspect_ratio',
            type: 'string',
            required: false,
            description: '输出图片宽高比',
            enumValues: [
              { label: 'auto', value: 'auto' },
              { label: '1:1', value: '1:1' },
              { label: '3:4', value: '3:4' },
              { label: '4:3', value: '4:3' },
              { label: '9:16', value: '9:16' },
              { label: '16:9', value: '16:9' },
              { label: '2:3', value: '2:3' },
              { label: '3:2', value: '3:2' },
            ],
            uiHint: 'select',
            abilities: [{ name: 'aspect_ratio', group: 'dimension' }],
          },
          {
            name: 'resolution',
            type: 'string',
            required: false,
            description: '输出分辨率',
            enumValues: [
              { label: '1K', value: '1k' },
              { label: '2K', value: '2k' },
            ],
            uiHint: 'select',
            abilities: [{ name: 'resolution', group: 'dimension' }],
          },
          {
            name: 'quality',
            type: 'string',
            required: false,
            description: '输出质量',
            enumValues: [
              { label: '低', value: 'low' },
              { label: '中', value: 'medium' },
              { label: '高', value: 'high' },
            ],
            uiHint: 'select',
            abilities: [{ name: 'quality' }],
          },
          {
            name: 'n',
            type: 'number',
            required: false,
            description: '输出图片数量（默认 1，最大 10）',
            defaultValue: 1,
            minValue: 1,
            maxValue: 10,
            abilities: [{ name: 'n' }],
          },
          // {
          //   name: 'response_format',
          //   type: 'string',
          //   required: false,
          //   description: '输出格式',
          //   defaultValue: 'url',
          //   enumValues: [
          //     { label: 'URL', value: 'url' },
          //     { label: 'Base64 JSON', value: 'b64_json' },
          //   ],
          //   uiHint: 'select',
          // },
        ],
        layout: {
          rows: [
            { fields: ['model', 'aspect_ratio', 'resolution', 'quality', 'n'] },
            { fields: ['prompt'] },
            { fields: ['image'] },
          ],
          fieldConfig: {
            prompt: { colSpan: 1 },
            image: { colSpan: 1 },
          },
        },
      },
      outputSchema: createStandardOutputSchema('Grok 图片编辑标准化输出', [
        { name: 'created', type: 'number', required: true, description: '创建时间戳' },
        {
          name: 'data',
          type: 'array',
          required: true,
          description: '编辑后的图片数组',
          fields: [
            { name: 'url', type: 'string', required: false, description: '图片 URL' },
            { name: 'b64_json', type: 'string', required: false, description: 'Base64 编码图片' },
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
    const input = context.input as GrokEditImageInput;
    const ctx = executor.createContext(context, authContext);
    const { logger } = executor;

    logger.info(`[${ctx.taskRunId}] 开始 Grok 图片编辑任务`, {
      model: input.model,
      prompt: input.prompt,
      imageUrl: input.image[0],
    });

    const startTime = Date.now();

    try {
      if (ctx.taskRunId) {
        await executor.updateProgress(ctx, 10, '下载原始图片');
      }

      // 下载图片（取第一张）
      if (!input.image || input.image.length === 0) {
        throw new Error('未提供图片');
      }
      const imageUrl = input.image[0].startsWith('/')
        ? `http://localhost:${process.env.PORT ?? 3000}${input.image[0]}`
        : input.image[0];

      logger.debug(`[${ctx.taskRunId}] 下载图片: ${imageUrl}`);
      const { buffer: imgBuffer, contentType } = await executor.downloadBuffer(imageUrl);
      const ext = contentType.split('/')[1]?.split(';')[0] || 'webp';
      const filename = `image.${ext}`;

      logger.debug(`[${ctx.taskRunId}] 图片下载完成`, { size: imgBuffer.byteLength, contentType });

      if (ctx.taskRunId) {
        await executor.updateProgress(ctx, 20, '发送图片编辑请求');
      }

      // 构建 multipart 字段
      const fields: Record<string, string | number> = {
        model: input.model,
        prompt: input.prompt,
        n: input.n ?? 1,
      };
      if (input.aspect_ratio) fields.aspect_ratio = input.aspect_ratio;
      if (input.response_format) fields.response_format = input.response_format;
      if (input.resolution) fields.resolution = input.resolution;
      if (input.quality) fields.quality = input.quality;

      const response = await executor.requestMultipart<GrokEditImageOutput>(ctx, {
        path: '/images/edits',
        fields,
        files: [{ fieldName: 'image', filename, contentType, buffer: imgBuffer }],
      });

      // 验证响应
      if (!response.data || !Array.isArray(response.data) || response.data.length === 0) {
        throw new Error('API 返回数据格式无效');
      }
      if (!response.usage || typeof response.usage !== 'object') {
        throw new Error('API 返回用量数据格式无效');
      }

      if (ctx.taskRunId) {
        await executor.updateProgress(ctx, 90, '图片编辑完成');
      }

      const duration = Date.now() - startTime;
      logger.info(`[${ctx.taskRunId}] Grok 图片编辑完成`, { duration, imageCount: response.data.length });

      return {
        success: true,
        data: {
          content: response.data.map((img) => ({
            type: 'image' as const,
            url: img.url,
            ...(img.b64_json ? { metadata: { b64_json: img.b64_json } } : {}),
          })),
          raw: response,
        },
        duration,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      logger.error(`[${ctx.taskRunId}] Grok 图片编辑失败`, error, { duration });
      return {
        success: false,
        error: {
          code: 'GROK_IMAGE_EDIT_FAILED',
          message: error.message || 'Grok 图片编辑失败',
        },
        duration,
      };
    }
  }
}
