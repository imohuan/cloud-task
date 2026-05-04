/**
 * NewAPI平台注册模块
 */

import { NewApiPlatformProvider } from '@platforms/newapi/newapi.platform';
import { NewApiApiKeyAuthStrategy } from '@platforms/newapi/auth/newapi-api-key.auth';
import { GenerateImageApiHandler } from '@platforms/newapi/categories/image/generate-image.api';
import { GrokGenerateImageApiHandler } from '@platforms/newapi/categories/image/grok-generate-image.api';
import { GrokEditImageApiHandler } from '@platforms/newapi/categories/image/grok-edit-image.api';
import { QueryImageTaskApiHandler } from '@platforms/newapi/categories/image/query-image-task.api';
import { GrokGenerateVideoApiHandler } from '@platforms/newapi/categories/video/grok-generate-video.api';
import { OpenAIChatGenerateImageApiHandler } from '@platforms/newapi/categories/chat/openai.api';

// 导出平台提供者
export { NewApiPlatformProvider };

// 导出认证策略
export { NewApiApiKeyAuthStrategy };

// 导出 API 处理器
export { GenerateImageApiHandler, GrokGenerateImageApiHandler, GrokEditImageApiHandler, QueryImageTaskApiHandler, GrokGenerateVideoApiHandler, OpenAIChatGenerateImageApiHandler };

/**
 * 注册NewAPI平台到注册中心
 */
export function registerNewApiPlatform(registry: import('@core/application/registry/registry-center').RegistryCenter) {
  // 1. 注册平台
  const platform = new NewApiPlatformProvider();
  registry.registerPlatform(platform);

  // 2. 注册认证策略
  const authStrategy = new NewApiApiKeyAuthStrategy();
  registry.registerAuthStrategy('newapi', authStrategy);

  // 3. 注册 API 处理器
  const generateImageApi = new GenerateImageApiHandler();
  registry.registerApiHandler('newapi', 'image', generateImageApi);

  const grokGenerateImageApi = new GrokGenerateImageApiHandler();
  registry.registerApiHandler('newapi', 'image', grokGenerateImageApi);

  const grokEditImageApi = new GrokEditImageApiHandler();
  registry.registerApiHandler('newapi', 'image', grokEditImageApi);

  const grokGenerateVideoApi = new GrokGenerateVideoApiHandler();
  registry.registerApiHandler('newapi', 'video', grokGenerateVideoApi);

  const openAIChatGenerateImageApi = new OpenAIChatGenerateImageApiHandler();
  registry.registerApiHandler('newapi', 'chat', openAIChatGenerateImageApi);

  // const queryImageTaskApi = new QueryImageTaskApiHandler();
  // registry.registerApiHandler('newapi', 'image', queryImageTaskApi);
}
