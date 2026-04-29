import type { ApiCallContext, ApiMetadata, AsyncTaskResult, SyncApiResult } from '@core/contracts/api.types';
import type { AuthContext } from '@core/contracts/auth.types';

/**
 * 轮询配置
 * 用于控制第三方异步任务的轮询策略
 */
export interface PollingConfig {
  /** 基础轮询间隔（毫秒），默认 15000 */
  intervalMs: number;
  /** 最大轮询次数，默认 480（约 2 小时） */
  maxPollCount: number;
  /** 退避策略：固定间隔 / 线性增长 / 指数增长 */
  backoffStrategy: 'fixed' | 'linear' | 'exponential';
  /** 退避乘数（指数策略用），默认 1.3 */
  backoffMultiplier: number;
  /** 最大轮询间隔（毫秒），默认 300000（5 分钟） */
  maxIntervalMs: number;
}

/**
 * 轮询状态
 * 从数据库 output_payload 中解析得到
 */
export interface PollingState {
  /** 第三方任务 ID */
  thirdPartyTaskId: string;
  /** 轮询阶段标识 */
  pollingPhase: string;
  /** 已轮询次数 */
  pollCount: number;
  /** 下次轮询时间（ISO 字符串） */
  nextPollAt?: string;
  /** 上次轮询时间（ISO 字符串） */
  lastPollAt?: string;
  /** 上次轮询结果 */
  lastPollResult?: Record<string, any>;
  /** 原始创建响应数据（保留） */
  [key: string]: any;
}

/**
 * API 处理器基类
 * 所有具体接口实现都必须继承此类
 */
export abstract class BaseApiHandler<TInput = any, TOutput = any> {
  /**
   * 获取 API 元数据
   */
  abstract getMetadata(): ApiMetadata;

  /**
   * 执行 API 调用
   * @param context 调用上下文
   * @param authContext 认证上下文（由认证策略生成）
   */
  abstract execute(
    context: ApiCallContext,
    authContext: AuthContext
  ): Promise<SyncApiResult<TOutput> | AsyncTaskResult>;

  /**
   * 轮询第三方异步任务状态（可选实现）
   * 当 execute() 返回 _polling 标识后，系统会定时调用此方法
   * @param context 调用上下文
   * @param authContext 认证上下文
   * @param pollingState 当前轮询状态（从数据库 output_payload 解析）
   */
  async poll(
    context: ApiCallContext,
    authContext: AuthContext,
    pollingState: PollingState
  ): Promise<SyncApiResult<TOutput>> {
    throw new Error('此 Handler 未实现 poll() 方法');
  }

  /**
   * 获取轮询配置（可选实现）
   * 不实现则使用默认配置
   */
  getPollingConfig(): PollingConfig {
    return {
      intervalMs: 15000,
      maxPollCount: 480,
      backoffStrategy: 'exponential',
      backoffMultiplier: 1.3,
      maxIntervalMs: 300000,
    };
  }

  /**
   * 验证输入参数（可选实现）
   */
  async validateInput(input: Record<string, any>): Promise<{
    valid: boolean;
    errors?: Array<{ field: string; message: string }>;
  }> {
    const schema = this.getMetadata().inputSchema;
    const errors: Array<{ field: string; message: string }> = [];

    for (const field of schema.fields) {
      if (field.required && input[field.name] === undefined) {
        errors.push({
          field: field.name,
          message: `缺少必填字段: ${field.name}`,
        });
      }

      // 类型校验
      if (input[field.name] !== undefined) {
        const value = input[field.name];
        const actualType = Array.isArray(value) ? 'array' : typeof value;
        
        if (actualType !== field.type && !(actualType === 'number' && field.type === 'number')) {
          errors.push({
            field: field.name,
            message: `字段类型错误: 期望 ${field.type}, 实际 ${actualType}`,
          });
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * API 初始化（可选实现）
   */
  async initialize(): Promise<void> {
    // 默认空实现
  }

  /**
   * API 销毁（可选实现）
   */
  async destroy(): Promise<void> {
    // 默认空实现
  }
}
