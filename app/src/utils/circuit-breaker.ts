/**
 * 熔断器模式实现
 * 
 * 【设计说明】
 * 熔断器用于防止级联故障，当外部服务故障时快速失败，保护系统稳定性
 * 
 * 【状态流转】
 * CLOSED(正常) -> OPEN(熔断) -> HALF_OPEN(半开) -> CLOSED
 * 
 * 【使用场景】
 * - 第三方 API 调用
 * - 数据库操作
 * - 微服务间调用
 */

import { Logger } from './logger';

const logger = new Logger('CircuitBreaker');

/** 熔断器状态 */
export enum CircuitBreakerState {
  CLOSED = 'CLOSED',       // 正常状态，允许请求通过
  OPEN = 'OPEN',           // 熔断状态，快速失败
  HALF_OPEN = 'HALF_OPEN', // 半开状态，尝试恢复
}

export interface CircuitBreakerOptions {
  /** 触发熔断的失败次数阈值 */
  failureThreshold: number;
  /** 熔断后恢复等待时间（毫秒） */
  resetTimeoutMs: number;
  /** 半开状态允许的测试请求数 */
  halfOpenMaxCalls: number;
  /** 成功阈值（半开状态成功多少次后关闭） */
  successThreshold: number;
  /** 需要计为失败的错误判断 */
  shouldCountFailure?: (error: Error) => boolean;
}

/** 默认配置 */
const DEFAULT_OPTIONS: CircuitBreakerOptions = {
  failureThreshold: 5,
  resetTimeoutMs: 30000,
  halfOpenMaxCalls: 3,
  successThreshold: 2,
};

/** 熔断器统计信息 */
export interface CircuitBreakerMetrics {
  state: CircuitBreakerState;
  failures: number;
  successes: number;
  lastFailureTime: Date | null;
  consecutiveSuccesses: number;
  totalCalls: number;
  rejectedCalls: number;
}

export class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private options: CircuitBreakerOptions;
  private failures = 0;
  private successes = 0;
  private lastFailureTime: Date | null = null;
  private consecutiveSuccesses = 0;
  private totalCalls = 0;
  private rejectedCalls = 0;
  private halfOpenCalls = 0;
  private nextAttempt: number = Date.now();
  private readonly name: string;

  constructor(name: string, options: Partial<CircuitBreakerOptions> = {}) {
    this.name = name;
    this.options = { ...DEFAULT_OPTIONS, ...options };
    logger.debug(`熔断器 ${name} 已创建`, this.options);
  }

  /**
   * 执行被保护的函数
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.totalCalls++;

    // 检查当前状态
    if (this.state === CircuitBreakerState.OPEN) {
      if (Date.now() < this.nextAttempt) {
        this.rejectedCalls++;
        logger.warn(`熔断器 ${this.name} 处于 OPEN 状态，请求被拒绝`);
        throw new CircuitBreakerOpenError(`服务 ${this.name} 暂时不可用，请稍后重试`);
      }
      // 超时，尝试进入半开状态
      logger.info(`熔断器 ${this.name} 尝试进入 HALF_OPEN 状态`);
      this.state = CircuitBreakerState.HALF_OPEN;
      this.halfOpenCalls = 0;
    }

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      if (this.halfOpenCalls >= this.options.halfOpenMaxCalls) {
        this.rejectedCalls++;
        logger.warn(`熔断器 ${this.name} 半开状态测试请求已满`);
        throw new CircuitBreakerOpenError(`服务 ${this.name} 恢复测试中，请稍后重试`);
      }
      this.halfOpenCalls++;
    }

    // 执行实际请求
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error: any) {
      this.onFailure(error);
      throw error;
    }
  }

  /** 处理成功 */
  private onSuccess(): void {
    this.consecutiveSuccesses++;

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      if (this.consecutiveSuccesses >= this.options.successThreshold) {
        logger.info(`熔断器 ${this.name} 恢复，进入 CLOSED 状态`);
        this.reset();
      } else {
        logger.debug(`熔断器 ${this.name} 半开状态成功 ${this.consecutiveSuccesses}/${this.options.successThreshold}`);
      }
    } else {
      // CLOSED 状态下的成功，重置连续失败计数
      if (this.failures > 0) {
        this.failures = 0;
        logger.debug(`熔断器 ${this.name} 失败计数已重置`);
      }
    }
  }

  /** 处理失败 */
  private onFailure(error: Error): void {
    // 判断是否应该计为失败
    if (this.options.shouldCountFailure && !this.options.shouldCountFailure(error)) {
      logger.debug(`熔断器 ${this.name} 错误不计入失败统计`, { error: error.message });
      return;
    }

    this.failures++;
    this.lastFailureTime = new Date();
    this.consecutiveSuccesses = 0;

    logger.debug(`熔断器 ${this.name} 失败计数: ${this.failures}/${this.options.failureThreshold}`);

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      // 半开状态下失败，重新熔断
      logger.warn(`熔断器 ${this.name} 半开状态测试失败，重新熔断`);
      this.trip();
    } else if (this.failures >= this.options.failureThreshold) {
      // 达到失败阈值，触发熔断
      logger.warn(`熔断器 ${this.name} 达到失败阈值，进入 OPEN 状态`);
      this.trip();
    }
  }

  /** 触发熔断 */
  private trip(): void {
    this.state = CircuitBreakerState.OPEN;
    this.nextAttempt = Date.now() + this.options.resetTimeoutMs;
    this.halfOpenCalls = 0;
    logger.warn(`熔断器 ${this.name} 已熔断，将在 ${this.options.resetTimeoutMs}ms 后尝试恢复`);
  }

  /** 重置熔断器 */
  reset(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.failures = 0;
    this.consecutiveSuccesses = 0;
    this.halfOpenCalls = 0;
    this.rejectedCalls = 0;
    logger.info(`熔断器 ${this.name} 已重置`);
  }

  /** 获取当前状态 */
  getState(): CircuitBreakerState {
    return this.state;
  }

  /** 获取统计信息 */
  getMetrics(): CircuitBreakerMetrics {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      consecutiveSuccesses: this.consecutiveSuccesses,
      totalCalls: this.totalCalls,
      rejectedCalls: this.rejectedCalls,
    };
  }
}

/** 熔断器打开错误 */
export class CircuitBreakerOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitBreakerOpenError';
  }
}

/** 熔断器管理器（用于管理多个熔断器） */
export class CircuitBreakerRegistry {
  private breakers = new Map<string, CircuitBreaker>();

  /** 获取或创建熔断器 */
  get(name: string, options?: Partial<CircuitBreakerOptions>): CircuitBreaker {
    if (!this.breakers.has(name)) {
      this.breakers.set(name, new CircuitBreaker(name, options));
    }
    return this.breakers.get(name)!;
  }

  /** 获取所有熔断器状态 */
  getAllMetrics(): Record<string, CircuitBreakerMetrics> {
    const metrics: Record<string, CircuitBreakerMetrics> = {};
    this.breakers.forEach((breaker, name) => {
      metrics[name] = breaker.getMetrics();
    });
    return metrics;
  }

  /** 重置所有熔断器 */
  resetAll(): void {
    this.breakers.forEach(breaker => breaker.reset());
  }
}

/** 全局熔断器注册表 */
export const circuitBreakerRegistry = new CircuitBreakerRegistry();
