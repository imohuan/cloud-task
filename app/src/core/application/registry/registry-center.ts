/**
 * 注册中心
 * 
 * 【设计说明】
 * 管理所有平台、认证策略、API 处理器的注册与查询
 * 
 * 【核心原则】
 * 类内部只定义简短 ID（如 'api-key'、'generate'），注册中心根据嵌套关系自动拼装完整 ID：
 * - 认证策略：platformId.strategyId → 'yunwu.api-key'
 * - API：platformId.categoryId.apiId → 'yunwu.image.generate'
 * - 分类：platformId 由注册中心自动注入
 * 
 * 【高可用优化】
 * 1. 添加初始化状态检查，防止重复初始化
 * 2. 添加错误处理，单个平台初始化失败不影响其他平台
 * 3. 使用 Logger 替代 console
 * 
 * 【扩展性】
 * 支持动态注册/注销平台（未来扩展热更新功能）
 */

import type { BasePlatformProvider, CategoryMetadata, PlatformMetadata } from '@core/domain/platform/base-platform.provider';
import type { BaseAuthStrategy } from '@core/domain/auth/base-auth.strategy';
import type { BaseApiHandler } from '@core/domain/api/base-api.handler';
import type { ApiMetadata } from '@core/contracts/api.types';
import type { AuthStrategyMetadata } from '@core/contracts/auth.types';
import { Logger } from '../../../utils/logger';

/**
 * 注册项
 */
interface RegistryEntry {
  platform: BasePlatformProvider;
  authStrategies: Map<string, BaseAuthStrategy>;
  apiHandlers: Map<string, BaseApiHandler>;
  /** API 简短 ID → 分类 ID 的映射 */
  apiCategoryMap: Map<string, string>;
  /** 完整 ID → 简短 ID 的映射（用于查找） */
  apiIdMap: Map<string, string>;  // fullId -> simpleId
  strategyIdMap: Map<string, string>;  // fullId -> simpleId
}

export class RegistryCenter {
  private platforms = new Map<string, RegistryEntry>();
  private initialized = false;
  private readonly logger = new Logger('RegistryCenter');

  /**
   * 注册平台
   */
  registerPlatform(platform: BasePlatformProvider): void {
    const metadata = platform.getMetadata();
    
    if (this.platforms.has(metadata.id)) {
      this.logger.warn(`平台重复注册: ${metadata.id}`);
      throw new Error(`平台已注册: ${metadata.id}`);
    }

    this.platforms.set(metadata.id, {
      platform,
      authStrategies: new Map(),
      apiHandlers: new Map(),
      apiCategoryMap: new Map(),
      apiIdMap: new Map(),
      strategyIdMap: new Map(),
    });
    
    this.logger.info(`平台已注册: ${metadata.name} (${metadata.id})`);
  }

  /**
   * 注册认证策略
   * 自动拼装完整 ID：platformId.strategyId
   */
  registerAuthStrategy(
    platformId: string,
    strategy: BaseAuthStrategy
  ): void {
    const entry = this.platforms.get(platformId);
    if (!entry) {
      this.logger.error(`注册认证策略失败: 平台未注册 ${platformId}`);
      throw new Error(`平台未注册: ${platformId}`);
    }

    const metadata = strategy.getMetadata();
    const simpleId = metadata.id;
    const fullId = `${platformId}.${simpleId}`;

    entry.authStrategies.set(simpleId, strategy);
    entry.strategyIdMap.set(fullId, simpleId);
    this.logger.debug(`认证策略已注册: ${fullId}`);
  }

  /**
   * 注册 API 处理器
   * 自动拼装完整 ID：platformId.categoryId.apiId
   */
  registerApiHandler(
    platformId: string,
    categoryId: string,
    handler: BaseApiHandler
  ): void {
    const entry = this.platforms.get(platformId);
    if (!entry) {
      this.logger.error(`注册 API 处理器失败: 平台未注册 ${platformId}`);
      throw new Error(`平台未注册: ${platformId}`);
    }

    const metadata = handler.getMetadata();
    const simpleId = metadata.id;
    const fullId = `${platformId}.${categoryId}.${simpleId}`;
    
    // 验证分类是否存在
    const categories = entry.platform.getCategories();
    const category = categories.find(c => c.id === categoryId);
    if (!category) {
      this.logger.error(`注册 API 处理器失败: 分类不存在 ${categoryId}`);
      throw new Error(`分类不存在: ${categoryId}`);
    }

    entry.apiHandlers.set(simpleId, handler);
    entry.apiCategoryMap.set(simpleId, categoryId);
    entry.apiIdMap.set(fullId, simpleId);
    this.logger.info(`API 处理器已注册: ${fullId} (${metadata.executionMode}) v${metadata.version || 'unknown'}`);
    this.logger.debug(`  处理器类: ${handler.constructor.name}`);
  }

  /**
   * 初始化所有平台
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      this.logger.debug('注册中心已经初始化，跳过');
      return;
    }

    this.logger.info(`开始初始化 ${this.platforms.size} 个平台...`);

    const initPromises: Promise<void>[] = [];

    for (const [platformId, entry] of this.platforms.entries()) {
      const initPromise = (async () => {
        try {
          this.logger.debug(`初始化平台: ${platformId}`);
          await entry.platform.initialize();
          
          // 并行初始化认证策略
          const strategyPromises = Array.from(entry.authStrategies.entries()).map(
            async ([strategyId, strategy]) => {
              this.logger.debug(`初始化认证策略: ${platformId}.${strategyId}`);
            }
          );

          // 并行初始化 API 处理器
          const handlerPromises = Array.from(entry.apiHandlers.entries()).map(
            async ([handlerId, handler]) => {
              this.logger.debug(`初始化 API 处理器: ${platformId}.${handlerId}`);
              await handler.initialize();
            }
          );

          await Promise.all([...strategyPromises, ...handlerPromises]);
          this.logger.info(`平台初始化完成: ${platformId}`);
        } catch (error) {
          this.logger.error(`平台初始化失败: ${platformId}`, error);
        }
      })();

      initPromises.push(initPromise);
    }

    await Promise.all(initPromises);

    this.initialized = true;
    this.logger.info('注册中心初始化完成');
  }

  /**
   * 获取所有平台列表
   */
  getPlatforms(): PlatformMetadata[] {
    return Array.from(this.platforms.values()).map(entry =>
      entry.platform.getMetadata()
    );
  }

  /**
   * 获取平台详情
   */
  getPlatform(platformId: string): PlatformMetadata | undefined {
    const entry = this.platforms.get(platformId);
    return entry?.platform.getMetadata();
  }

  /**
   * 获取平台下的分类列表（自动注入 platformId）
   */
  getCategories(platformId: string): CategoryMetadata[] {
    const entry = this.platforms.get(platformId);
    const categories = entry?.platform.getCategories() ?? [];
    // 自动注入 platformId
    return categories.map(c => ({ ...c, platformId }));
  }

  /**
   * 获取平台下的认证策略列表（返回完整 ID，自动注入 platformId）
   */
  getAuthStrategies(platformId: string): AuthStrategyMetadata[] {
    const entry = this.platforms.get(platformId);
    if (!entry) {
      return [];
    }
    return Array.from(entry.authStrategies.values()).map(s => {
      const meta = s.getMetadata();
      return {
        ...meta,
        id: `${platformId}.${meta.id}`,
        platformId,
      };
    });
  }

  /**
   * 获取认证策略实例
   * 支持完整 ID（如 'yunwu.api-key'）和简短 ID（如 'api-key'）
   */
  getAuthStrategy(platformId: string, strategyId: string): BaseAuthStrategy | undefined {
    const entry = this.platforms.get(platformId);
    if (!entry) return undefined;
    
    // 先尝试简短 ID
    const strategy = entry.authStrategies.get(strategyId);
    if (strategy) return strategy;
    
    // 再尝试完整 ID 映射
    const simpleId = entry.strategyIdMap.get(strategyId);
    if (simpleId) return entry.authStrategies.get(simpleId);
    
    return undefined;
  }

  /**
   * 获取 API 处理器
   * 支持完整 ID（如 'yunwu.image.generate'）和简短 ID（如 'generate'）
   */
  getApiHandler(apiId: string): BaseApiHandler | undefined {
    // 先遍历所有平台查找（支持完整 ID）
    for (const [platformId, entry] of this.platforms.entries()) {
      // 尝试完整 ID 映射
      const simpleId = entry.apiIdMap.get(apiId);
      if (simpleId) return entry.apiHandlers.get(simpleId);
    }
    
    // 再尝试简短 ID（遍历所有平台）
    for (const entry of this.platforms.values()) {
      const handler = entry.apiHandlers.get(apiId);
      if (handler) return handler;
    }
    
    return undefined;
  }

  /**
   * 获取 API 处理器及其所在的平台和分类信息
   */
  private getApiHandlerWithContext(apiId: string): { handler: BaseApiHandler; platformId: string; categoryId: string; simpleId: string } | undefined {
    for (const [platformId, entry] of this.platforms.entries()) {
      // 尝试完整 ID 映射
      const simpleId = entry.apiIdMap.get(apiId);
      if (simpleId) {
        const categoryId = entry.apiCategoryMap.get(simpleId) || '';
        return { handler: entry.apiHandlers.get(simpleId)!, platformId, categoryId, simpleId };
      }
    }
    
    // 尝试简短 ID
    for (const [platformId, entry] of this.platforms.entries()) {
      const handler = entry.apiHandlers.get(apiId);
      if (handler) {
        const categoryId = entry.apiCategoryMap.get(apiId) || '';
        return { handler, platformId, categoryId, simpleId: apiId };
      }
    }
    
    return undefined;
  }

  /**
   * 获取平台下的所有 API 列表（返回完整 metadata，自动注入关系字段）
   */
  getApisByPlatform(platformId: string): ApiMetadata[] {
    const entry = this.platforms.get(platformId);
    if (!entry) {
      return [];
    }
    
    const result: ApiMetadata[] = [];
    for (const [simpleId, handler] of entry.apiHandlers.entries()) {
      const meta = handler.getMetadata();
      const catId = entry.apiCategoryMap.get(simpleId) || meta.categoryId || '';
      const fullId = `${platformId}.${catId}.${simpleId}`;
      result.push(this.enrichApiMetadata(meta, platformId, catId, fullId));
    }
    return result;
  }

  /**
   * 获取分类下的所有 API 列表（返回完整 metadata）
   */
  getApisByCategory(platformId: string, categoryId: string): ApiMetadata[] {
    const entry = this.platforms.get(platformId);
    if (!entry) {
      return [];
    }
    
    const result: ApiMetadata[] = [];
    for (const [simpleId, handler] of entry.apiHandlers.entries()) {
      const catId = entry.apiCategoryMap.get(simpleId);
      if (catId === categoryId) {
        const meta = handler.getMetadata();
        const fullId = `${platformId}.${categoryId}.${simpleId}`;
        result.push(this.enrichApiMetadata(meta, platformId, categoryId, fullId));
      }
    }
    return result;
  }

  /**
   * 获取 API 详情（返回完整 metadata）
   * 支持完整 ID 和简短 ID
   */
  getApiMetadata(apiId: string): ApiMetadata | undefined {
    const ctx = this.getApiHandlerWithContext(apiId);
    if (!ctx) return undefined;
    
    const meta = ctx.handler.getMetadata();
    const fullId = `${ctx.platformId}.${ctx.categoryId}.${ctx.simpleId}`;
    return this.enrichApiMetadata(meta, ctx.platformId, ctx.categoryId, fullId);
  }

  /**
   * 丰富 API metadata：注入 platformId、categoryId，拼装完整 ID 和 authStrategyId
   */
  private enrichApiMetadata(meta: ApiMetadata, platformId: string, categoryId: string, fullId: string): ApiMetadata {
    const simpleAuthStrategyId = meta.authStrategyId;
    const fullAuthStrategyId = simpleAuthStrategyId.includes('.') 
      ? simpleAuthStrategyId 
      : `${platformId}.${simpleAuthStrategyId}`;

    return {
      ...meta,
      id: fullId,
      platformId,
      categoryId,
      authStrategyId: fullAuthStrategyId,
    };
  }

  /**
   * 销毁所有平台
   */
  async destroy(): Promise<void> {
    if (!this.initialized) {
      this.logger.debug('注册中心未初始化，跳过销毁');
      return;
    }

    this.logger.info(`开始销毁 ${this.platforms.size} 个平台...`);

    const destroyPromises: Promise<void>[] = [];

    for (const [platformId, entry] of this.platforms.entries()) {
      const destroyPromise = (async () => {
        try {
          const handlerPromises = Array.from(entry.apiHandlers.values()).map(
            async (handler) => {
              try {
                await handler.destroy();
              } catch (error) {
                this.logger.error(`API 处理器销毁失败`, error);
              }
            }
          );

          await Promise.all(handlerPromises);
          
          await entry.platform.destroy();
          this.logger.debug(`平台销毁完成: ${platformId}`);
        } catch (error) {
          this.logger.error(`平台销毁失败: ${platformId}`, error);
        }
      })();

      destroyPromises.push(destroyPromise);
    }

    await Promise.all(destroyPromises);

    this.platforms.clear();
    this.initialized = false;
    this.logger.info('注册中心销毁完成');
  }
}

// 单例导出
export const registry = new RegistryCenter();
