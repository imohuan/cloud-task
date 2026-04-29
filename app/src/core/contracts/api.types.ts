import type { InputSchema, OutputSchema } from '@core/contracts/field-definition';

/**
 * API 执行模式
 */
export type ExecutionMode = 'sync' | 'async';

/**
 * API 调用上下文（由框架适配层传入）
 */
export interface ApiCallContext {
  /** 认证配置 ID */
  authProfileId: string;
  /** 用户输入参数 */
  input: Record<string, any>;
  /** 请求 ID（用于日志追踪） */
  requestId: string;
  /** 调用者信息（可选） */
  caller?: {
    userId?: string;
    ip?: string;
    userAgent?: string;
  };
}

/**
 * 同步 API 调用结果
 */
export interface SyncApiResult<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  /** 调用耗时（毫秒） */
  duration: number;
  /** 原始响应（可选，用于调试） */
  rawResponse?: any;
}

/**
 * 异步任务创建结果
 */
export interface AsyncTaskResult {
  success: boolean;
  taskId?: string;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * API 元数据（类内部定义）
 * platformId、categoryId 由注册中心根据嵌套关系自动注入
 * id 使用简短形式（如 'generate'），注册中心自动拼装为 'yunwu.image.generate'
 */
export interface ApiMetadata {
  /** API ID（简短形式，如 'generate'，注册中心自动拼装为完整 ID） */
  id: string;
  /** API 名称 */
  name: string;
  /** API 描述 */
  description?: string;
  /** 所属平台 ID（注册中心自动注入） */
  platformId?: string;
  /** 所属分类 ID（注册中心自动注入） */
  categoryId?: string;
  /** 执行模式 */
  executionMode: ExecutionMode;
  /** 输入字段定义 */
  inputSchema: InputSchema;
  /** 输出字段定义 */
  outputSchema: OutputSchema;
  /** 需要的认证策略 ID（简短形式，如 'api-key'，注册中心自动拼装） */
  authStrategyId: string;
  /** 是否启用 */
  enabled: boolean;
  /** 版本号 */
  version?: string;
  /** 标签 */
  tags?: string[];
}
