import { TaskRunRepository, QueueTask } from '@core/ports/task-run.repository';
import {
  BaseTaskDispatcher,
  TaskHandler,
} from '@adapters/task-dispatcher/base-task-dispatcher';
import { Logger } from '../../utils/logger';
import { getConfig } from '../../config';
import { hostname } from 'os';

const logger = new Logger('PostgresTaskDispatcher');

function getWorkerInfo() {
  return {
    hostname: hostname(),
    pid: process.pid,
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.version,
    env: process.env.NODE_ENV || 'development',
  };
}

export class PostgresTaskDispatcher extends BaseTaskDispatcher {
  private readonly taskRunRepository: TaskRunRepository;
  private readonly processingTimeoutSec: number;

  constructor(taskRunRepository: TaskRunRepository, taskHandler: TaskHandler) {
    super(taskHandler);
    this.taskRunRepository = taskRunRepository;
    this.processingTimeoutSec = getConfig().worker.processingTimeoutSec;
  }

  async dispatch(task: {
    apiId: string;
    authProfileId: string;
    input: Record<string, any>;
  }): Promise<string> {
    logger.info(`派发任务: apiId=${task.apiId}`);
    const taskRun = await this.taskRunRepository.create({
      apiId: task.apiId,
      authProfileId: task.authProfileId,
      status: 'pending',
      input: task.input,
      progress: 0,
    });
    logger.info(`任务已入队: ${taskRun.id}, status=pending`);
    return taskRun.id;
  }

  protected async claimNextTask() {
    return this.taskRunRepository.claimNextTask(getWorkerInfo());
  }

  protected async releaseStaleTasks(): Promise<void> {
    const result = await this.taskRunRepository.releaseStaleTasks(
      this.processingTimeoutSec,
      this.maxAttempts,
    );
    if (result.released > 0 || result.failed > 0) {
      logger.info(`释放超时任务: ${result.released} 个重新入队, ${result.failed} 个标记失败`);
    }
  }

  protected async handleTaskError(task: QueueTask, error: any): Promise<void> {
    await this.taskRunRepository.handleTaskError(task, error, this.maxAttempts);
  }
}
