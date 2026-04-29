/**
 * 日志工具
 * 
 * 【设计原则】
 * 1. 提供结构化日志，便于后续日志收集和分析
 * 2. 支持不同日志级别，生产环境可减少日志输出
 * 3. 统一的日志格式，包含时间戳、上下文等信息
 * 4. 支持上下文注入，便于追踪请求链路
 * 5. 实时写入本地文件，便于问题排查
 * 
 * 【高可用优化】
 * - 日志输出使用异步方式，避免阻塞主流程
 * - 错误日志自动包含堆栈信息
 * - 支持通过环境变量动态调整日志级别
 * - 文件日志按日期轮转，防止单文件过大
 * - 文件写入使用缓冲，定期刷盘提高性能
 */

import { existsSync, mkdirSync } from 'fs';
import { appendFile } from 'fs/promises';
import { join } from 'path';
import { LogPaths, getConfig } from '../config';
import { getAppRoot } from './app-root';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LoggerOptions {
  level?: LogLevel;
  enableConsole?: boolean;
  enableFile?: boolean;
  logDir?: string;
}

/** 日志级别优先级 */
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/** 格式化时间戳 - 标准格式: YYYY-MM-DD HH:mm:ss.SSS */
function formatTimestamp(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const ms = String(date.getMilliseconds()).padStart(3, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${ms}`;
}

/** 获取日期字符串 (YYYY-MM-DD) */
function formatDate(date: Date = new Date()): string {
  return date.toISOString().split('T')[0];
}

/** 调用位置信息 */
interface CallLocation {
  file: string;
  line: number;
  column: number;
}

/** 获取调用位置 - 通过 Error stack 解析 */
function getCallLocation(): CallLocation {
  const stack = new Error().stack;
  if (!stack) return { file: 'unknown', line: 0, column: 0 };

  const lines = stack.split('\n');
  // 跳过前3行: Error 构造器、getCallLocation 本身、log 方法
  // 找到实际调用 Logger.debug/info/warn/error 的位置
  for (let i = 4; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/at\s+(?:.*?\s+)?\(?(.*?):(\d+):(\d+)\)?$/);
    if (match) {
      const [, filePath, lineNum, colNum] = match;
      // 排除 node_modules 和 logger.ts 本身
      if (!filePath.includes('node_modules') && !filePath.includes('logger.ts')) {
        // 提取文件名（相对于项目根目录）
        const fileName = filePath.includes(process.cwd())
          ? filePath.substring(filePath.indexOf(process.cwd()) + process.cwd().length + 1)
          : filePath;
        return {
          file: fileName,
          line: parseInt(lineNum, 10),
          column: parseInt(colNum, 10),
        };
      }
    }
  }
  return { file: 'unknown', line: 0, column: 0 };
}

/** 判断是否应该记录该级别日志 */
function shouldLog(configLevel: LogLevel, messageLevel: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[messageLevel] >= LOG_LEVEL_PRIORITY[configLevel];
}

/** 颜色代码 */
const COLORS = {
  reset: '\x1b[0m',
  debug: '\x1b[36m', // 青色
  info: '\x1b[32m',  // 绿色
  warn: '\x1b[33m',  // 黄色
  error: '\x1b[31m', // 红色
};

/** 文件日志管理器 - 单例 */
class FileLogManager {
  private static instance: FileLogManager;
  private logDir: string;
  private writeQueue: string[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private currentDate: string;
  private readonly FLUSH_INTERVAL_MS = 1000; // 1秒刷盘一次

  private constructor() {
    // 确保 LogPaths 已初始化
    if (!LogPaths.dir) {
      LogPaths.init();
    }
    this.logDir = LogPaths.dir;
    this.currentDate = formatDate();
    this.ensureLogDir();
    this.startFlushTimer();
  }

  static getInstance(): FileLogManager {
    if (!FileLogManager.instance) {
      FileLogManager.instance = new FileLogManager();
    }
    return FileLogManager.instance;
  }

  /** 确保日志目录存在 */
  private ensureLogDir(): void {
    if (!existsSync(this.logDir)) {
      mkdirSync(this.logDir, { recursive: true });
    }
  }

  /** 获取当前日志文件路径 */
  private getLogFilePath(): string {
    const date = formatDate();
    // 日期变化时更新
    if (date !== this.currentDate) {
      this.currentDate = date;
    }
    return join(this.logDir, `app-${this.currentDate}.log`);
  }

  /** 启动定时刷盘 */
  private startFlushTimer(): void {
    if (this.flushTimer) return;
    this.flushTimer = setInterval(() => this.flush(), this.FLUSH_INTERVAL_MS);
  }

  /** 停止定时刷盘 */
  stopFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /** 将日志加入写入队列 */
  enqueue(logLine: string): void {
    this.writeQueue.push(logLine);
    // 队列超过100条立即刷盘
    if (this.writeQueue.length >= 100) {
      this.flush();
    }
  }

  /** 刷盘 - 将队列中的日志写入文件 */
  async flush(): Promise<void> {
    if (this.writeQueue.length === 0) return;
    
    const lines = this.writeQueue.splice(0, this.writeQueue.length);
    const content = lines.join('\n') + '\n';
    
    try {
      await appendFile(this.getLogFilePath(), content, 'utf-8');
    } catch (err) {
      // 文件写入失败时输出到控制台
      console.error('[Logger] 文件写入失败:', err);
    }
  }

  /** 同步刷盘（用于关闭时） */
  async flushSync(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flush();
  }
}

export class Logger {
  private context: string;
  private options: Required<LoggerOptions>;
  private fileManager: FileLogManager;

  constructor(context: string, options: LoggerOptions = {}) {
    this.context = context;
    const logConfig = getConfig().log;
    this.options = {
      level: options.level || logConfig.level,
      enableConsole: options.enableConsole ?? logConfig.enableConsole,
      enableFile: options.enableFile ?? true, // 默认启用文件日志
      logDir: options.logDir || join(getAppRoot(), 'logs'),
    };
    this.fileManager = FileLogManager.getInstance();
  }

  /** 格式化文件日志行 - 标准文本格式 */
  private formatFileLogLine(
    level: LogLevel,
    message: string,
    location: CallLocation,
    metadata?: Record<string, any>
  ): string {
    const timestamp = formatTimestamp();
    const levelStr = level.toUpperCase().padEnd(5);
    const locationStr = `[${location.file}:${location.line}:${location.column}]`;
    let line = `${timestamp} [${levelStr}] [${this.context}] ${locationStr} ${message}`;
    
    if (metadata && Object.keys(metadata).length > 0) {
      line += ' ' + JSON.stringify(metadata);
    }
    
    return line;
  }

  /** 输出到控制台 */
  private consoleOutput(level: LogLevel, message: string, metadata?: Record<string, any>): void {
    if (!this.options.enableConsole) return;
    
    const timestamp = formatTimestamp();
    const color = COLORS[level];
    const reset = COLORS.reset;
    
    const prefix = `${timestamp} ${color}[${level.toUpperCase()}]${reset} [${this.context}]`;
    
    if (metadata && Object.keys(metadata).length > 0) {
      console.log(prefix, message, metadata);
    } else {
      console.log(prefix, message);
    }
  }

  /** 输出到文件 */
  private fileOutput(level: LogLevel, message: string, location: CallLocation, metadata?: Record<string, any>): void {
    if (!this.options.enableFile) return;
    
    const logLine = this.formatFileLogLine(level, message, location, metadata);
    this.fileManager.enqueue(logLine);
  }

  /** 输出日志 */
  private log(level: LogLevel, message: string, metadata?: Record<string, any>): void {
    if (!shouldLog(this.options.level, level)) return;
    
    const location = getCallLocation();
    this.consoleOutput(level, message, metadata);
    this.fileOutput(level, message, location, metadata);
  }

  /** 调试日志 */
  debug(message: string, metadata?: Record<string, any>): void {
    this.log('debug', message, metadata);
  }

  /** 信息日志 */
  info(message: string, metadata?: Record<string, any>): void {
    this.log('info', message, metadata);
  }

  /** 警告日志 */
  warn(message: string, metadata?: Record<string, any>): void {
    this.log('warn', message, metadata);
  }

  /** 错误日志 */
  error(message: string, error?: Error | unknown, metadata?: Record<string, any>): void {
    const errorMetadata: Record<string, any> = { ...metadata };
    const location = getCallLocation();
    
    if (error instanceof Error) {
      errorMetadata.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    } else if (error !== undefined) {
      errorMetadata.error = error;
    }
    
    if (!shouldLog(this.options.level, 'error')) return;
    
    this.consoleOutput('error', message, errorMetadata);
    this.fileOutput('error', message, location, errorMetadata);
  }

  /** 创建子 Logger，继承当前配置 */
  child(subContext: string): Logger {
    return new Logger(`${this.context}.${subContext}`, {
      level: this.options.level,
      enableConsole: this.options.enableConsole,
      enableFile: this.options.enableFile,
    });
  }

  /** 同步刷盘所有日志（用于优雅关闭） */
  static async flushAll(): Promise<void> {
    await FileLogManager.getInstance().flushSync();
  }
}

/** 全局 Logger 实例 - 所有模块使用此实例确保写入同一文件 */
export const rootLogger = new Logger('App');
