import type { AuthStrategyMetadata } from '@core/contracts/auth.types';

/**
 * 平台分类元数据（类内部定义，platformId 由注册中心自动注入）
 */
export interface CategoryMetadata {
  /** 分类 ID（简短形式，如 'image'） */
  id: string;
  /** 分类名称 */
  name: string;
  /** 分类描述 */
  description?: string;
  /** 所属平台 ID（注册中心自动注入） */
  platformId?: string;
  /** 图标 */
  icon?: string;
  /** 排序 */
  order: number;
}

/**
 * 平台元数据
 */
export interface PlatformMetadata {
  /** 平台 ID */
  id: string;
  /** 平台名称 */
  name: string;
  /** 平台描述 */
  description?: string;
  /** 平台官网 */
  website?: string;
  /** 图标 */
  icon?: string;
  /** 是否启用 */
  enabled: boolean;
}

/**
 * 平台提供者基类
 * 所有平台实现都必须继承此类
 */
export abstract class BasePlatformProvider {
  /**
   * 获取平台元数据
   */
  abstract getMetadata(): PlatformMetadata;

  /**
   * 获取平台下的所有分类
   */
  abstract getCategories(): CategoryMetadata[];

  /**
   * 获取平台支持的认证策略列表
   */
  abstract getAuthStrategies(): AuthStrategyMetadata[];

  /**
   * 平台初始化（可选实现）
   */
  async initialize(): Promise<void> {
    // 默认空实现，子类可覆盖
  }

  /**
   * 平台销毁（可选实现）
   */
  async destroy(): Promise<void> {
    // 默认空实现，子类可覆盖
  }
}
