/**
 * 任务调度器基类
 * 
 * 【问题分析】
 * 1. 直接读取 process.env，违反了依赖注入原则
 * 2. console 输出无法统一管理，不利于日志收集
 * 3. 缺少指数退避机制，失败任务可能频繁重试
 * 4. pollInterval 固定，无法动态调整
 * 
 * 【优化方向】
 * - 使用 Logger 替代 console
 * - 支持配置对象注入
 * - 添加指数退避策略
 */

import { TaskDispatcherPort } from '@core/ports/task-dispatcher.port';
import { Logger } from '../../utils/logger';
import { getConfig } from '../../config';

export interface TaskPayload {
  taskRunId: string;
  apiId: string;
  authProfileId: string;
  input: Record<string, any>;
}

export type TaskHandler = (payload: TaskPayload, helpers: {
  logger: {
    info: (msg: string) => void;
    error: (msg: string) => void;
    warn: (msg: string) => void;
  };
  job: {
    id: string;
    queue_name?: string;
    task_identifier: string;
    payload: unknown;
    priority: number;
    run_at: Date;
    attempts: number;
    max_attempts: number;
  };
}) => Promise<void>;

export type QueueTask = {
  id: string;
  apiId: string;
  authProfileId: string;
  input: Record<string, any>;
  retryCount: number;
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** 计算指数退避延迟 */
function calculateBackoffDelay(retryCount: number, baseDelay: number, maxDelay: number): number {
  const exponentialDelay = baseDelay * Math.pow(2, retryCount);
  return Math.min(exponentialDelay, maxDelay);
}

export interface TaskDispatcherConfig {
  concurrency?: number;
  pollIntervalMs?: number;
  maxAttempts?: number;
  enableExponentialBackoff?: boolean;
  maxBackoffMs?: number;
}

export abstract class BaseTaskDispatcher implements TaskDispatcherPort {
  protected readonly taskHandler: TaskHandler;
  protected readonly logger: Logger;

  protected running = false;
  protected workerPromises: Promise<void>[] = [];

  protected readonly concurrency: number;
  protected readonly pollIntervalMs: number;
  protected readonly maxAttempts: number;
  protected readonly enableExponentialBackoff: boolean;
  protected readonly maxBackoffMs: number;

  constructor(
    taskHandler: TaskHandler,
    config: TaskDispatcherConfig = {}
  ) {
    this.taskHandler = taskHandler;
    this.logger = new Logger('TaskDispatcher');
    
    // 优先使用传入的配置，其次使用全局配置，最后使用默认值
    const workerConfig = getConfig().worker;
    this.concurrency = config.concurrency ?? workerConfig.concurrency;
    this.pollIntervalMs = config.pollIntervalMs ?? workerConfig.pollIntervalMs;
    this.maxAttempts = config.maxAttempts ?? workerConfig.maxAttempts;
    this.enableExponentialBackoff = config.enableExponentialBackoff ?? workerConfig.enableExponentialBackoff;
    this.maxBackoffMs = config.maxBackoffMs ?? workerConfig.maxBackoffMs;
  }

  abstract dispatch(task: {
    apiId: string;
    authProfileId: string;
    input: Record<string, any>;
  }): Promise<string>;

  protected abstract claimNextTask(): Promise<QueueTask | null>;
  protected abstract releaseStaleTasks(): Promise<void>;
  protected abstract handleTaskError(task: QueueTask, error: any): Promise<void>;

  async start(): Promise<void> {
    if (this.running) {
      this.logger.warn('任务调度器已经在运行中');
      return;
    }
    this.running = true;

    this.logger.info(`启动任务调度器`, {
      concurrency: this.concurrency,
      pollIntervalMs: this.pollIntervalMs,
      maxAttempts: this.maxAttempts,
      enableExponentialBackoff: this.enableExponentialBackoff,
    });

    for (let i = 0; i < this.concurrency; i++) {
      this.logger.info(`启动 Worker-${i + 1}`);
      this.workerPromises.push(this.workerLoop(i + 1));
    }

    this.logger.info(`✅ 所有 Worker 已启动 (${this.concurrency} 个)`);
  }

  async stop(): Promise<void> {
    this.logger.info('正在停止任务调度器...');
    this.running = false;
    await Promise.allSettled(this.workerPromises);
    this.workerPromises = [];
    this.logger.info('✅ 任务调度器已停止');
  }

  private async workerLoop(workerNo: number): Promise<void> {
    const workerLogger = this.logger.child(`Worker-${workerNo}`);
    workerLogger.info(`Worker-${workerNo} 开始运行, pollIntervalMs=${this.pollIntervalMs}`);

    let idleCount = 0;
    let taskCount = 0;

    while (this.running) {
      try {
        workerLogger.verbose(`[Worker-${workerNo}] 开始新一轮循环, 释放过期任务...`);
        await this.releaseStaleTasks();
        
        workerLogger.verbose(`[Worker-${workerNo}] 尝试获取任务...`);
        const task = await this.claimNextTask();

        if (!task) {
          idleCount++;
          // 每10次空闲打印一次日志，避免日志过多
          if (idleCount % 10 === 0) {
            workerLogger.verbose(`Worker-${workerNo} 空闲中... (${idleCount} 轮未获取到任务, 已执行 ${taskCount} 个任务)`);
          }
          await sleep(this.pollIntervalMs);
          continue;
        }

        // 获取到任务，重置空闲计数
        idleCount = 0;
        taskCount++;
        workerLogger.info(`[Worker-${workerNo}] 🎯 成功获取任务 #${taskCount}: ${task.id}, apiId=${task.apiId}`);
        
        try {
          await this.executeTask(task, workerNo, workerLogger);
          workerLogger.info(`[Worker-${workerNo}] ✅ 任务 #${taskCount} 执行完毕: ${task.id}`);
        } catch (execError) {
          workerLogger.error(`[Worker-${workerNo}] ❌ 任务 #${taskCount} 执行出错: ${task.id}`, execError);
          // 错误已在 executeTask 中处理，继续下一轮
        }
      } catch (error: any) {
        workerLogger.error(`[Worker-${workerNo}] ❌ 工作循环异常`, error);
        await sleep(this.pollIntervalMs);
      }
    }

    workerLogger.info(`Worker-${workerNo} 已停止, 共执行 ${taskCount} 个任务`);
  }

  private async executeTask(task: QueueTask, workerNo: number, workerLogger: Logger): Promise<void> {
    const payload: TaskPayload = {
      taskRunId: task.id,
      apiId: task.apiId,
      authProfileId: task.authProfileId,
      input: task.input || {},
    };

    const helpers = {
      logger: {
        info: (msg: string) => workerLogger.info(msg),
        error: (msg: string) => workerLogger.error(msg),
        warn: (msg: string) => workerLogger.warn(msg),
      },
      job: {
        id: task.id,
        queue_name: `api-${task.apiId}`,
        task_identifier: 'api_task',
        payload,
        priority: 0,
        run_at: new Date(),
        attempts: task.retryCount + 1,
        max_attempts: this.maxAttempts,
      },
    };

    workerLogger.info(`[Worker-${workerNo}] 🚀 开始执行任务: ${task.id}, apiId=${task.apiId}`);
    workerLogger.debug(`[Worker-${workerNo}] 任务详情:`, { 
      taskRunId: task.id, 
      apiId: task.apiId, 
      authProfileId: task.authProfileId,
      inputKeys: Object.keys(task.input || {})
    });
    
    try {
      workerLogger.info(`[Worker-${workerNo}] 📤 调用 taskHandler 处理任务: ${task.id}`);
      await this.taskHandler(payload, helpers);
      workerLogger.info(`[Worker-${workerNo}] ✅ 任务执行成功: ${task.id}`);
    } catch (error: any) {
      workerLogger.error(`[Worker-${workerNo}] ❌ 任务执行失败: ${task.id}`, error);
      await this.handleTaskError(task, error);
      
      /** 指数退避：失败后增加等待时间，避免频繁重试 */
      if (this.enableExponentialBackoff) {
        const backoffDelay = calculateBackoffDelay(task.retryCount, this.pollIntervalMs, this.maxBackoffMs);
        workerLogger.info(`任务 ${task.id} 将在 ${backoffDelay}ms 后重试`);
        await sleep(backoffDelay);
      }
    }
  }
}
