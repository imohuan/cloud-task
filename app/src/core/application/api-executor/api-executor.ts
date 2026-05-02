import type { ApiCallContext, SyncApiResult } from '@core/contracts/api.types';
import type { AuthContext } from '@core/contracts/auth.types';
import type { ApiCallLog } from '@core/ports/task-run.repository';
import { getTaskRunRepository } from '@adapters/persistence';
import { Logger } from '@utils/logger';
import { getConfig } from '@config/index';
import * as http from 'node:http';
import * as https from 'node:https';
import { randomBytes } from 'node:crypto';

/**
 * API 执行配置选项
 */
export interface ApiExecutorOptions {
  /** 请求超时时间（毫秒），默认 30 分钟 */
  timeoutMs?: number;
  /** 默认 baseUrl */
  defaultBaseUrl?: string;
  /** 是否自动更新任务进度 */
  autoUpdateProgress?: boolean;
  /** 开始时的进度值（0-100） */
  startProgress?: number;
  /** 完成时的进度值（0-100） */
  completeProgress?: number;
}

/**
 * HTTP 请求配置
 */
export interface HttpRequestConfig {
  /** 请求路径（相对于 baseUrl） */
  path: string;
  /** 请求方法 */
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  /** 请求体 */
  body?: Record<string, unknown>;
  /** 额外的请求头 */
  headers?: Record<string, string>;
  /** 自定义超时时间（毫秒） */
  timeoutMs?: number;
}

/**
 * Multipart 文件字段
 */
export interface MultipartFile {
  /** 表单字段名 */
  fieldName: string;
  /** 文件名 */
  filename: string;
  /** MIME 类型 */
  contentType: string;
  /** 文件内容 */
  buffer: Buffer;
}

/**
 * Multipart 请求配置
 */
export interface MultipartRequestConfig {
  /** 请求路径（相对于 baseUrl） */
  path: string;
  /** 请求方法，默认 POST */
  method?: 'POST' | 'PUT' | 'PATCH';
  /** 普通字段（字符串/数字会被转为字符串） */
  fields?: Record<string, string | number | undefined | null>;
  /** 文件字段 */
  files?: MultipartFile[];
  /** 额外的请求头 */
  headers?: Record<string, string>;
  /** 自定义超时时间（毫秒） */
  timeoutMs?: number;
}

/**
 * 标准化资源项
 */
export interface StandardResource {
  /** 资源类型 */
  type: 'text' | 'image' | 'video' | 'audio' | 'file';
  /** 资源 URL（适用于 image/video/audio/file） */
  url?: string;
  /** 文本内容（适用于 text） */
  text?: string;
  /** MIME 类型（可选） */
  mimeType?: string;
  /** 其他扩展字段 */
  metadata?: Record<string, any>;
}

/**
 * 标准化 API 输出
 * 直接返回资源列表，前端根据 type 渲染对应元素
 */
export interface StandardApiOutput {
  /** 资源内容列表 */
  content: StandardResource[];
  /** 原始响应数据（保留用于调试） */
  raw?: any;
  /**
   * 进入轮询状态的控制字段（框架内部使用）
   * execute() 返回此字段时，任务会被标记为 polling 状态，
   * 系统会在 nextPollAt 到期后调用 handler.poll() 继续查询第三方任务状态
   */
  _polling?: {
    /** 第三方平台任务 ID */
    thirdPartyTaskId: string;
    /**
     * 轮询阶段标识（用于区分同一 API 的多阶段轮询）
     * 示例：'video_create' | 'video_query' | 'video_download' | 'upload' | 'render'
     */
    pollingPhase: string;
  };
  /** 继续轮询的控制字段（框架内部使用） */
  _continuePolling?: boolean;
}

/**
 * 生成标准化的 outputSchema（供 getMetadata 使用）
 * @param description schema 描述
 * @param rawFields raw 原始响应数据的字段定义（可选，不提供则 raw 为简单 object）
 */
export function createStandardOutputSchema(
  description?: string,
  rawFields?: Array<{
    name: string;
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';
    required: boolean;
    description?: string;
    fields?: any[];
  }>
) {
  const fields = [
    {
      name: 'content',
      type: 'array' as const,
      required: true,
      description: '资源内容列表',
      fields: [
        {
          name: 'type',
          type: 'string' as const,
          required: true,
          description: '资源类型: text/image/video/audio/file',
        },
        {
          name: 'url',
          type: 'string' as const,
          required: false,
          description: '资源 URL',
        },
        {
          name: 'text',
          type: 'string' as const,
          required: false,
          description: '文本内容',
        },
        {
          name: 'mimeType',
          type: 'string' as const,
          required: false,
          description: 'MIME 类型',
        },
      ],
    },
    {
      name: 'raw',
      type: 'object' as const,
      required: false,
      description: '原始响应数据',
      ...(rawFields ? { fields: rawFields } : {}),
    },
  ];

  return {
    description: description || '标准化输出（资源列表格式）',
    fields,
  };
}

/**
 * API 执行上下文
 */
export interface ExecutionContext {
  /** 任务运行 ID */
  taskRunId?: string;
  /** 请求 ID */
  requestId: string;
  /** 日志记录器 */
  logger: Logger;
  /** 认证上下文 */
  authContext: AuthContext;
  /** 开始时间 */
  startTime: number;
  /** API 调用日志（实时累积） */
  apiCallLogs: ApiCallLog[];
}

/**
 * 通用 API 执行器
 * 封装 HTTP 请求、任务进度管理和错误处理
 */
export class ApiExecutor {
  private options: Required<ApiExecutorOptions>;
  readonly logger: Logger;
  /** 执行器名称，用于日志和调试 */
  readonly name: string;

  constructor(
    name: string,
    options: ApiExecutorOptions = {}
  ) {
    this.name = name;
    this.logger = new Logger(name);
    this.options = {
      timeoutMs: getConfig().server.requestTimeoutMs,
      defaultBaseUrl: 'https://yunwu.ai/v1',
      autoUpdateProgress: true,
      startProgress: 10,
      completeProgress: 90,
      ...options,
    };
  }

  /**
   * 创建执行上下文
   */
  createContext(
    apiContext: ApiCallContext,
    authContext: AuthContext
  ): ExecutionContext {
    const taskRunId = (apiContext as ApiCallContext & { taskRunId?: string }).taskRunId;

    return {
      taskRunId,
      requestId: apiContext.requestId,
      logger: this.logger,
      authContext,
      startTime: Date.now(),
      apiCallLogs: [],
    };
  }

  /**
   * 更新任务进度
   */
  async updateProgress(
    context: ExecutionContext,
    progress: number,
    message?: string
  ): Promise<void> {
    if (!context.taskRunId) return;

    try {
      await getTaskRunRepository().updateStatus(context.taskRunId, 'running', { progress });
      context.logger.debug(`[${context.taskRunId}] 进度更新: ${progress}%`, { message });
    } catch (error) {
      context.logger.warn(`[${context.taskRunId}] 更新进度失败`, { error: String(error) });
    }
  }

  /**
   * 追加 API 调用日志到数据库（实时保存）
   */
  async appendApiCallLog(
    context: ExecutionContext,
    log: Omit<ApiCallLog, 'index'>,
  ): Promise<void> {
    if (!context.taskRunId) return;

    const index = context.apiCallLogs.length;
    const logEntry: ApiCallLog = { ...log, index };
    context.apiCallLogs.push(logEntry);

    try {
      const repo = getTaskRunRepository();
      const task = await repo.findById(context.taskRunId);
      if (!task) return;
      const logs = task.apiCallLogs || [];
      logs.push(logEntry);
      await repo.updateStatus(context.taskRunId, task.status, { apiCallLogs: logs });
      context.logger.debug(`[${context.taskRunId}] API 调用日志已保存 #${index}`, { phase: log.phase });
    } catch (error) {
      context.logger.warn(`[${context.taskRunId}] 保存 API 调用日志失败`, { error: String(error) });
    }
  }

  /**
   * 获取认证后的请求头
   */
  getAuthHeaders(context: ExecutionContext): Record<string, string> {
    const headers = context.authContext.headers as Record<string, string>;

    if (!headers?.['Authorization']) {
      throw new Error('缺少 API 密钥');
    }

    return headers;
  }

  /**
   * 获取 baseUrl
   */
  getBaseUrl(context: ExecutionContext): string {
    return (context.authContext.metadata as { baseUrl?: string })?.baseUrl
      || this.options.defaultBaseUrl;
  }

  /**
   * 发送 HTTP 请求（带超时控制，并实时记录调用日志）
   *
   * 使用 node:http/https 替代 fetch + AbortSignal.timeout()：
   * Bun 的 fetch 内部有硬编码的 5 分钟（300s）socket 超时，
   * AbortSignal 无法覆盖该限制，导致长时间请求提前断开。
   * node:http/https 的 socket.setTimeout() 可直接设置 socket 级超时，不受此限制。
   */
  async request<T = any>(
    context: ExecutionContext,
    config: HttpRequestConfig,
    phase = 'api-call',
  ): Promise<T> {
    const baseUrl = this.getBaseUrl(context);
    const headers = this.getAuthHeaders(context);
    const url = `${baseUrl}${config.path}`;
    const timeoutMs = config.timeoutMs ?? this.options.timeoutMs;
    const callStartTime = Date.now();
    const method = config.method || 'POST';

    context.logger.debug(`[${context.taskRunId}] 调用 API`, {
      url,
      method,
      timeoutMs,
    });

    let statusCode: number | undefined;
    let responseBody: Record<string, any> | string | undefined;
    let errorMessage: string | undefined;

    try {
      const data = await new Promise<T>((resolve, reject) => {
        const parsedUrl = new URL(url);
        const reqModule = parsedUrl.protocol === 'https:' ? https : http;
        const bodyStr = config.body ? JSON.stringify(config.body) : undefined;

        const req = reqModule.request(
          {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
            path: parsedUrl.pathname + parsedUrl.search,
            method,
            headers: {
              ...headers,
              'Content-Type': 'application/json',
              ...config.headers,
              ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
            },
          },
          (res) => {
            statusCode = res.statusCode;
            const chunks: Buffer[] = [];
            res.on('data', (chunk: Buffer) => chunks.push(chunk));
            res.on('end', () => {
              const raw = Buffer.concat(chunks).toString('utf-8');
              let parsed: any;
              try {
                parsed = JSON.parse(raw);
              } catch {
                reject(new Error(`响应 JSON 解析失败: ${raw.slice(0, 200)}`));
                return;
              }
              if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
                const msg = `HTTP ${res.statusCode}: ${parsed?.error?.message || parsed?.message || res.statusMessage}`;
                errorMessage = msg;
                reject(new Error(msg));
              } else {
                responseBody = parsed;
                resolve(parsed as T);
              }
            });
            res.on('error', reject);
          }
        );

        req.setTimeout(timeoutMs, () => {
          req.destroy(Object.assign(new Error('The operation timed out.'), { name: 'TimeoutError' }));
        });

        req.on('error', (err) => {
          errorMessage = errorMessage || err.message;
          reject(err);
        });

        if (bodyStr) req.write(bodyStr);
        req.end();
      });

      return data;
    } catch (error: any) {
      errorMessage = errorMessage || error.message || String(error);
      throw error;
    } finally {
      const durationMs = Date.now() - callStartTime;

      // 实时保存 API 调用日志
      await this.appendApiCallLog(context, {
        phase,
        method,
        url,
        headers: this.sanitizeHeaders(headers),
        requestBody: config.body,
        statusCode,
        responseBody,
        error: errorMessage,
        durationMs,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * 发送 multipart/form-data 请求（带超时控制，并实时记录调用日志）
   *
   * 支持普通字段和文件字段，使用 node:http/https 实现，绕过 Bun fetch 的 5 分钟 socket 限制。
   */
  async requestMultipart<T = any>(
    context: ExecutionContext,
    config: MultipartRequestConfig,
    phase = 'api-call',
  ): Promise<T> {
    const baseUrl = this.getBaseUrl(context);
    const headers = this.getAuthHeaders(context);
    const url = `${baseUrl}${config.path}`;
    const timeoutMs = config.timeoutMs ?? this.options.timeoutMs;
    const callStartTime = Date.now();
    const method = config.method || 'POST';

    const boundary = `----CloudTaskBoundary${randomBytes(16).toString('hex')}`;
    const CRLF = '\r\n';
    const parts: Buffer[] = [];

    const logFields: Record<string, unknown> = {};
    for (const [name, value] of Object.entries(config.fields || {})) {
      if (value === undefined || value === null) continue;
      const strValue = String(value);
      logFields[name] = strValue;
      parts.push(Buffer.from(
        `--${boundary}${CRLF}` +
        `Content-Disposition: form-data; name="${name}"${CRLF}${CRLF}` +
        `${strValue}${CRLF}`,
      ));
    }

    const logFiles: Array<{ fieldName: string; filename: string; size: number; contentType: string }> = [];
    for (const file of config.files || []) {
      logFiles.push({ fieldName: file.fieldName, filename: file.filename, size: file.buffer.byteLength, contentType: file.contentType });
      parts.push(Buffer.from(
        `--${boundary}${CRLF}` +
        `Content-Disposition: form-data; name="${file.fieldName}"; filename="${file.filename}"${CRLF}` +
        `Content-Type: ${file.contentType}${CRLF}${CRLF}`,
      ));
      parts.push(file.buffer);
      parts.push(Buffer.from(CRLF));
    }
    parts.push(Buffer.from(`--${boundary}--${CRLF}`));
    const body = Buffer.concat(parts);

    context.logger.debug(`[${context.taskRunId}] 调用 API (multipart)`, {
      url, method, timeoutMs,
      fieldCount: Object.keys(logFields).length,
      fileCount: logFiles.length,
      bodySize: body.byteLength,
    });

    let statusCode: number | undefined;
    let responseBody: Record<string, any> | string | undefined;
    let errorMessage: string | undefined;

    try {
      const data = await new Promise<T>((resolve, reject) => {
        const parsedUrl = new URL(url);
        const reqModule = parsedUrl.protocol === 'https:' ? https : http;

        const req = reqModule.request(
          {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
            path: parsedUrl.pathname + parsedUrl.search,
            method,
            headers: {
              ...headers,
              ...config.headers,
              'Content-Type': `multipart/form-data; boundary=${boundary}`,
              'Content-Length': body.byteLength,
            },
          },
          (res) => {
            statusCode = res.statusCode;
            const chunks: Buffer[] = [];
            res.on('data', (chunk: Buffer) => chunks.push(chunk));
            res.on('end', () => {
              const raw = Buffer.concat(chunks).toString('utf-8');
              let parsed: any;
              try { parsed = JSON.parse(raw); } catch {
                reject(new Error(`响应 JSON 解析失败: ${raw.slice(0, 200)}`));
                return;
              }
              if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
                const msg = `HTTP ${res.statusCode}: ${parsed?.error?.message || parsed?.message || res.statusMessage}`;
                errorMessage = msg;
                reject(new Error(msg));
              } else {
                responseBody = parsed;
                resolve(parsed as T);
              }
            });
            res.on('error', reject);
          },
        );

        req.setTimeout(timeoutMs, () => {
          req.destroy(Object.assign(new Error('The operation timed out.'), { name: 'TimeoutError' }));
        });
        req.on('error', (err) => { errorMessage = errorMessage || err.message; reject(err); });
        req.write(body);
        req.end();
      });

      return data;
    } catch (error: any) {
      errorMessage = errorMessage || error.message || String(error);
      throw error;
    } finally {
      const durationMs = Date.now() - callStartTime;
      await this.appendApiCallLog(context, {
        phase, method, url,
        headers: this.sanitizeHeaders(headers),
        requestBody: { fields: logFields, files: logFiles },
        statusCode, responseBody, error: errorMessage, durationMs,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * 脱敏请求头（移除敏感信息）
   */
  private sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
    const sanitized: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      const lowerKey = key.toLowerCase();
      if (lowerKey === 'authorization') {
        sanitized[key] = value.length > 20 ? `${value.slice(0, 10)}...${value.slice(-4)}` : '***';
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  /**
   * 执行 API 调用（完整流程）
   * @template TInput 输入类型
   * @template TResponse API 原始响应类型
   * @template TResult 最终输出类型（默认与 TResponse 相同）
   * @param context 执行上下文
   * @param input 输入数据
   * @param requestConfig 请求配置
   * @param options 执行选项
   */
  async execute<TInput, TResponse, TResult = TResponse>(
    context: ExecutionContext,
    input: TInput,
    requestConfig: HttpRequestConfig | ((input: TInput) => HttpRequestConfig),
    options: {
      /** 构建请求体前的钩子 */
      onBeforeRequest?: (input: TInput, ctx: ExecutionContext) => Promise<void> | void;
      /** 请求成功后的钩子，可返回与原始响应不同的类型 */
      onSuccess?: (data: TResponse, ctx: ExecutionContext) => Promise<TResult> | TResult;
      /** 验证响应数据 */
      validateResponse?: (data: TResponse) => boolean | string;
      /** 自定义错误码 */
      errorCode?: string;
      /** 自定义错误消息 */
      errorMessage?: string;
    } = {}
  ): Promise<SyncApiResult<TResult>> {
    const { taskRunId, logger, startTime } = context;

    try {
      // 更新进度：开始调用
      if (this.options.autoUpdateProgress && taskRunId) {
        await this.updateProgress(context, this.options.startProgress, '开始调用 API');
      }

      // 执行前置钩子
      if (options.onBeforeRequest) {
        await options.onBeforeRequest(input, context);
      }

      // 构建请求配置
      const config = typeof requestConfig === 'function'
        ? requestConfig(input)
        : requestConfig;

      // 发送请求
      const response = await this.request<TResponse>(context, config);

      // 更新进度：API 调用完成
      if (this.options.autoUpdateProgress && taskRunId) {
        await this.updateProgress(context, this.options.completeProgress, 'API 调用完成');
      }

      // 验证响应数据
      if (options.validateResponse) {
        const validation = options.validateResponse(response);
        if (validation !== true) {
          throw new Error(typeof validation === 'string' ? validation : 'API 返回数据格式无效');
        }
      }

      // 执行成功钩子
      let result: TResult = response as unknown as TResult;
      if (options.onSuccess) {
        result = await options.onSuccess(response, context);
      }

      const duration = Date.now() - startTime;
      logger.info(`[${taskRunId}] API 调用完成`, { duration });

      return {
        success: true,
        data: result,
        duration,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      logger.error(`[${taskRunId}] API 调用失败`, error, { duration });

      return {
        success: false,
        error: this.formatError(error, options.errorCode, options.errorMessage),
        duration,
      };
    }
  }

  /**
   * 格式化错误
   */
  private formatError(
    error: any,
    customCode?: string,
    customMessage?: string
  ): { code: string; message: string } {
    let errorCode = customCode || 'API_CALL_FAILED';
    let errorMessage = customMessage || error.message || 'API 调用失败';

    if (error.message?.includes('HTTP')) {
      errorCode = 'API_CALL_FAILED';
    } else if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      errorCode = 'REQUEST_TIMEOUT';
      errorMessage = `请求超时（超过 ${this.options.timeoutMs / 60000} 分钟）`;
    }

    return { code: errorCode, message: errorMessage };
  }

}

/**
 * 创建 API 执行器的工厂函数
 */
export function createApiExecutor(
  handlerName: string,
  options?: ApiExecutorOptions
): ApiExecutor {
  return new ApiExecutor(handlerName, options);
}

/**
 * 计算下次轮询时间
 * @param pollCount 已轮询次数
 * @param config 轮询配置
 * @returns 下次轮询的 Date 对象
 */
export function calculateNextPollAt(
  pollCount: number,
  config: {
    intervalMs: number;
    backoffStrategy: 'fixed' | 'linear' | 'exponential';
    backoffMultiplier: number;
    maxIntervalMs: number;
  }
): Date {
  let interval = config.intervalMs;

  switch (config.backoffStrategy) {
    case 'linear':
      interval = config.intervalMs * (1 + pollCount * 0.2);
      break;
    case 'exponential':
      interval = config.intervalMs * Math.pow(config.backoffMultiplier, Math.floor(pollCount / 5));
      break;
    case 'fixed':
    default:
      interval = config.intervalMs;
      break;
  }

  interval = Math.min(interval, config.maxIntervalMs);
  return new Date(Date.now() + interval);
}
