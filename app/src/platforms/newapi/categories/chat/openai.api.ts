// 使用openai 接口进行请求 /v1/chat/completions
// 支持图片

import { BaseApiHandler } from '@core/domain/api/base-api.handler';
import type { ApiCallContext, ApiMetadata, SyncApiResult } from '@core/contracts/api.types';
import type { AuthContext } from '@core/contracts/auth.types';
import { createApiExecutor, createStandardOutputSchema, type StandardApiOutput } from '@core/application/api-executor';

const executor = createApiExecutor('OpenAIChatGenerateImage');

/**
 * OpenAI Chat 图片生成请求参数
 */
interface OpenAIChatGenerateImageInput {
  /** 用于生成图像的模型 */
  model: string;
  /** 所需图像的文本描述 */
  prompt: string;
}

/**
 * OpenAI Chat Completions 消息结构
 */
interface ChatMessage {
  role: string;
  content: string;
}

/**
 * OpenAI Chat Completions 响应选项
 */
interface ChatChoice {
  index: number;
  message: ChatMessage;
  finish_reason: string;
}

/**
 * OpenAI Chat Completions 用量统计
 */
interface ChatUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

/**
 * OpenAI Chat Completions 响应
 */
interface OpenAIChatCompletionsOutput {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: ChatChoice[];
  usage: ChatUsage;
}

/**
 * NewAPI平台 - OpenAI Chat 图片生成接口
 *
 * 说明：
 * - 通过 /v1/chat/completions 接口，使用 gpt-5.4-nano 模型生成图片
 * - 模型以文本形式返回图片 URL
 */
export class OpenAIChatGenerateImageApiHandler extends BaseApiHandler<OpenAIChatGenerateImageInput, StandardApiOutput> {
  getMetadata(): ApiMetadata {
    return {
      id: 'openai-chat-generate',
      name: 'OpenAI Chat 图片生成',
      description: '通过 Chat Completions 接口生成图片（支持 gpt-5.4-nano 等模型）',
      authStrategyId: 'api-key',
      executionMode: 'async',
      enabled: true,
      version: '1.0.0',
      tags: ['image', 'generation', 'ai', 'openai', 'chat'],
      inputSchema: {
        description: 'OpenAI Chat 图片生成参数',
        fields: [
          {
            name: 'model',
            type: 'string',
            required: true,
            description: '用于生成图像的模型',
            defaultValue: 'gpt-5.4-nano',
            enumValues: [
              { label: 'GPT-5.4 Nano', value: 'gpt-5.4-nano' },
            ],
            uiHint: 'select',
            abilities: [{ name: 'model' }],
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
        ],
        layout: {
          rows: [
            { fields: ['model'] },
            { fields: ['prompt'] },
          ],
          fieldConfig: {
            prompt: { colSpan: 1 },
          },
        },
      },
      outputSchema: createStandardOutputSchema('OpenAI Chat 图片生成标准化输出', [
        { name: 'created', type: 'number', required: true, description: '创建时间戳' },
        { name: 'content', type: 'string', required: true, description: '模型返回的文本内容（图片URL）' },
      ]),
    };
  }

  async execute(
    context: ApiCallContext,
    authContext: AuthContext
  ): Promise<SyncApiResult<StandardApiOutput>> {
    const input = context.input as OpenAIChatGenerateImageInput;
    const ctx = executor.createContext(context, authContext);
    const { logger } = executor;

    logger.info(`[${ctx.taskRunId}] 开始 OpenAI Chat 图片生成任务`, {
      model: input.model,
      prompt: input.prompt,
    });

    return executor.execute<OpenAIChatGenerateImageInput, OpenAIChatCompletionsOutput, StandardApiOutput>(
      ctx,
      input,
      (input) => ({
        path: '/chat/completions',
        body: {
          model: input.model,
          stream: false,
          messages: [
            {
              role: 'user',
              content: input.prompt,
            },
          ],
        },
      }),
      {
        validateResponse: (data) => {
          if (!data.choices || !Array.isArray(data.choices) || data.choices.length === 0) {
            return 'API 返回数据格式无效：缺少 choices';
          }
          if (!data.choices[0].message || typeof data.choices[0].message.content !== 'string') {
            return 'API 返回数据格式无效：缺少 message.content';
          }
          return true;
        },
        onSuccess: (data) => {
          const text = data.choices[0].message.content;
          return {
            content: [
              {
                type: 'text' as const,
                text,
              },
            ],
            raw: data,
          };
        },
        errorCode: 'OPENAI_CHAT_IMAGE_GENERATION_FAILED',
        errorMessage: 'OpenAI Chat 图片生成失败',
      }
    );
  }
}
