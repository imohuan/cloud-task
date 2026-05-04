/**
 * Apimart平台注册模块
 */

import { ApimartPlatformProvider } from '@platforms/apimart/apimart.platform';
import { ApimartApiKeyAuthStrategy } from '@platforms/apimart/auth/apimart-api-key.auth';
import { GenerateImageApiHandler } from '@platforms/apimart/categories/image/generate-image.api';

// 导出平台提供者
export { ApimartPlatformProvider };

// 导出认证策略
export { ApimartApiKeyAuthStrategy };

// 导出 API 处理器
export { GenerateImageApiHandler };

/**
 * 注册Apimart平台到注册中心
 */
export function registerApimartPlatform(registry: import('@core/application/registry/registry-center').RegistryCenter) {
  // 1. 注册平台
  const platform = new ApimartPlatformProvider();
  registry.registerPlatform(platform);

  // 2. 注册认证策略
  const authStrategy = new ApimartApiKeyAuthStrategy();
  registry.registerAuthStrategy('apimart', authStrategy);

  // 3. 注册 API 处理器
  const generateImageApi = new GenerateImageApiHandler();
  registry.registerApiHandler('apimart', 'image', generateImageApi);
}
