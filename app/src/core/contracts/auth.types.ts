import type { AuthSchema } from '@core/contracts/field-definition';

/**
 * 认证配置（存储在数据库中）
 */
export interface AuthProfile {
  id: string;
  /** 所属平台 ID */
  platformId: string;
  /** 认证策略 ID */
  authStrategyId: string;
  /** 认证配置名称 */
  name: string;
  /** 认证参数（加密存储） */
  credentials: Record<string, any>;
  /** 是否启用 */
  enabled: boolean;
  /** 创建时间 */
  createdAt: Date;
  /** 更新时间 */
  updatedAt: Date;
}

/**
 * 认证上下文（由认证策略生成，传递给 API 调用）
 */
export interface AuthContext {
  /** 认证配置 ID */
  authProfileId: string;
  /** 平台 ID */
  platformId: string;
  /** HTTP 请求头（由认证策略生成） */
  headers?: Record<string, string>;
  /** 查询参数（由认证策略生成） */
  queryParams?: Record<string, string>;
  /** 请求体字段（由认证策略生成） */
  bodyFields?: Record<string, any>;
  /** 其他认证信息 */
  metadata?: Record<string, any>;
}

/**
 * 认证策略元数据
 * 类内部只定义简短 id，注册中心自动注入 platformId 和拼装完整 id
 */
export interface AuthStrategyMetadata {
  /** 策略 ID（简短形式如 'api-key'，注册中心自动拼装为 'yunwu.api-key'） */
  id: string;
  /** 策略名称 */
  name: string;
  /** 策略描述 */
  description?: string;
  /** 所属平台 ID（注册中心自动注入） */
  platformId?: string;
  /** 认证字段定义 */
  authSchema: AuthSchema;
}
