/**
 * 重试工具
 * 
 * 【设计说明】
 * 提供带指数退避的重试机制，用于提高外部 API 调用的可靠性
 * 
 * 【使用场景】
 * - 网络请求失败时自动重试
 * - 数据库临时故障恢复
 * - 第三方服务限流时的退避
 */

import { Logger } from './logger';

const logger = new Logger('Retry');

export interface RetryOptions {
  /** 最大重试次数 */
  maxAttempts: number;
  /** 初始延迟（毫秒） */
  initialDelayMs: number;
  /** 最大延迟（毫秒） */
  maxDelayMs: number;
  /** 退避乘数 */
  backoffMultiplier: number;
  /** 需要重试的错误判断函数 */
  shouldRetry?: (error: Error) => boolean;
  /** 每次重试前的回调 */
  onRetry?: (attempt: number, delay: number, error: Error) => void;
}

/** 默认重试选项 */
const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};

/** 计算指数退避延迟 */
export function calculateBackoffDelay(
  attempt: number,
  initialDelayMs: number,
  maxDelayMs: number,
  multiplier: number
): number {
  const delay = initialDelayMs * Math.pow(multiplier, attempt - 1);
  return Math.min(delay, maxDelayMs);
}

/** 延迟函数 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 执行带重试的函数
 * 
 * @example
 * const result = await withRetry(async () => {
 *   return await fetchData();
 * }, { maxAttempts: 5 });
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      logger.debug(`执行尝试 ${attempt}/${opts.maxAttempts}`);
      return await fn();
    } catch (error: any) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // 判断是否需要重试
      if (opts.shouldRetry && !opts.shouldRetry(lastError)) {
        logger.debug('错误不需要重试，直接抛出');
        throw lastError;
      }

      // 如果是最后一次尝试，抛出错误
      if (attempt === opts.maxAttempts) {
        logger.warn(`重试 ${opts.maxAttempts} 次后仍然失败`);
        throw lastError;
      }

      // 计算延迟
      const delay = calculateBackoffDelay(
        attempt,
        opts.initialDelayMs,
        opts.maxDelayMs,
        opts.backoffMultiplier
      );

      logger.debug(`将在 ${delay}ms 后重试`, { attempt, error: lastError.message });

      // 回调通知
      if (opts.onRetry) {
        opts.onRetry(attempt, delay, lastError);
      }

      // 等待后重试
      await sleep(delay);
    }
  }

  // 理论上不会执行到这里
  throw lastError!;
}

/**
 * 创建重试装饰器
 * 
 * @example
 * class MyService {
 *   @retry({ maxAttempts: 3 })
 *   async fetchData() {
 *     // ...
 *   }
 * }
 */
export function retry(options: Partial<RetryOptions> = {}) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      return withRetry(() => originalMethod.apply(this, args), options);
    };

    return descriptor;
  };
}

/** 判断错误是否为网络错误（可重试） */
export function isNetworkError(error: Error): boolean {
  const networkErrorPatterns = [
    'ECONNRESET',
    'ETIMEDOUT',
    'ECONNREFUSED',
    'ENOTFOUND',
    'EPIPE',
    'network',
    'timeout',
    'socket hang up',
  ];
  
  const message = error.message.toLowerCase();
  return networkErrorPatterns.some(pattern => 
    message.includes(pattern.toLowerCase())
  );
}

/** 判断错误是否为限流错误（可重试） */
export function isRateLimitError(error: Error): boolean {
  const rateLimitPatterns = [
    'rate limit',
    'too many requests',
    '429',
    'throttled',
  ];
  
  const message = error.message.toLowerCase();
  return rateLimitPatterns.some(pattern => 
    message.includes(pattern.toLowerCase())
  );
}

/** 默认的可重试错误判断 */
export function shouldRetryByDefault(error: Error): boolean {
  return isNetworkError(error) || isRateLimitError(error);
}
