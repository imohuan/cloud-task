import { TaskRunRepository } from '@core/ports/task-run.repository';
import { PostgresTaskDispatcher } from '@adapters/task-dispatcher/postgres-task-dispatcher';
import { SqliteTaskDispatcher } from '@adapters/task-dispatcher/sqlite-task-dispatcher';
import type { TaskHandler } from '@adapters/task-dispatcher/base-task-dispatcher';
import { getConfig } from '../../config';

export { BaseTaskDispatcher, type TaskPayload, type TaskHandler, type QueueTask } from '@adapters/task-dispatcher/base-task-dispatcher';
export { PostgresTaskDispatcher } from '@adapters/task-dispatcher/postgres-task-dispatcher';
export { SqliteTaskDispatcher } from '@adapters/task-dispatcher/sqlite-task-dispatcher';

export function createTaskDispatcher(taskRunRepository: TaskRunRepository, taskHandler: TaskHandler) {
  const driver = getConfig().queue.driver;

  if (driver === 'sqlite') {
    return new SqliteTaskDispatcher(taskRunRepository, taskHandler);
  }

  return new PostgresTaskDispatcher(taskRunRepository, taskHandler);
}
