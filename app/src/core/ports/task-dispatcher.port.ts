import type { TaskRun } from '@core/ports/task-run.repository';

/**
 * 任务分发器端口
 * 用于将异步任务提交到任务队列
 */
export interface TaskDispatcherPort {
  /**
   * 分发任务
   * @param task 任务信息
   * @returns 任务 ID
   */
  dispatch(task: {
    apiId: string;
    authProfileId: string;
    input: Record<string, any>;
  }): Promise<string>;

  /**
   * 启动任务分发器
   */
  start(): Promise<void>;

  /**
   * 停止任务分发器
   */
  stop(): Promise<void>;
}
