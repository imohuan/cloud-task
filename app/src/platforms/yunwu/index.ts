/**
 * 云雾平台注册模块
 */

import { YunwuPlatformProvider } from '@platforms/yunwu/yunwu.platform';
import { YunwuApiKeyAuthStrategy } from '@platforms/yunwu/auth/yunwu-api-key.auth';
import { GenerateImageApiHandler } from '@platforms/yunwu/categories/image/generate-image.api';
import { GrokGenerateImageApiHandler } from '@platforms/yunwu/categories/image/grok-generate-image.api';
import { GrokEditImageApiHandler } from '@platforms/yunwu/categories/image/grok-edit-image.api';
import { QueryImageTaskApiHandler } from '@platforms/yunwu/categories/image/query-image-task.api';
import { GrokGenerateVideoApiHandler } from '@platforms/yunwu/categories/video/grok-generate-video.api';
import { OpenAIChatGenerateImageApiHandler } from '@platforms/yunwu/categories/chat/openai.api';

// 导出平台提供者
export { YunwuPlatformProvider };

// 导出认证策略
export { YunwuApiKeyAuthStrategy };

// 导出 API 处理器
export { GenerateImageApiHandler, GrokGenerateImageApiHandler, GrokEditImageApiHandler, QueryImageTaskApiHandler, GrokGenerateVideoApiHandler, OpenAIChatGenerateImageApiHandler };

/**
 * 注册云雾平台到注册中心
 */
export function registerYunwuPlatform(registry: import('@core/application/registry/registry-center').RegistryCenter) {
  // 1. 注册平台
  const platform = new YunwuPlatformProvider();
  registry.registerPlatform(platform);

  // 2. 注册认证策略
  const authStrategy = new YunwuApiKeyAuthStrategy();
  registry.registerAuthStrategy('yunwu', authStrategy);

  // 3. 注册 API 处理器
  const generateImageApi = new GenerateImageApiHandler();
  registry.registerApiHandler('yunwu', 'image', generateImageApi);

  const grokGenerateImageApi = new GrokGenerateImageApiHandler();
  registry.registerApiHandler('yunwu', 'image', grokGenerateImageApi);

  const grokEditImageApi = new GrokEditImageApiHandler();
  registry.registerApiHandler('yunwu', 'image', grokEditImageApi);

  const grokGenerateVideoApi = new GrokGenerateVideoApiHandler();
  registry.registerApiHandler('yunwu', 'video', grokGenerateVideoApi);

  const openAIChatGenerateImageApi = new OpenAIChatGenerateImageApiHandler();
  registry.registerApiHandler('yunwu', 'chat', openAIChatGenerateImageApi);

  // const queryImageTaskApi = new QueryImageTaskApiHandler();
  // registry.registerApiHandler('yunwu', 'image', queryImageTaskApi);
}
