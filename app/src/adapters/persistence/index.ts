import { getConfig } from '../../config';
import * as pg from '@adapters/persistence-postgres';
import * as sqlite from '@adapters/persistence-sqlite';
import type { TaskRunRepository } from '@core/ports/task-run.repository';
import { Logger } from '../../utils/logger';

const logger = new Logger('TaskRepository');

function wrapTaskRunRepository(repo: TaskRunRepository): TaskRunRepository {
  const originalUpdateStatus = repo.updateStatus.bind(repo);
  repo.updateStatus = async (id, status, updates) => {
    const result = await originalUpdateStatus(id, status, updates);
    const refreshParts = [`taskId=${result.id}`, `status=${result.status}`];
    if (result.progress !== undefined) {
      refreshParts.push(`progress=${result.progress}`);
    }
    logger.info(`[TASK_REFRESH] ${refreshParts.join(' ')} action=edit data=${JSON.stringify(result)}`);
    return result;
  };

  const originalCreate = repo.create.bind(repo);
  repo.create = async (task) => {
    const result = await originalCreate(task);
    logger.info(`[TASK_REFRESH] taskId=${result.id} status=${result.status} action=created data=${JSON.stringify(result)}`);
    return result;
  };

  return repo;
}

export async function initPersistence(): Promise<void> {
  if (getConfig().queue.driver === 'sqlite') {
    return sqlite.initPersistence();
  }
  return pg.initPersistence();
}

export async function shutdownPersistence(): Promise<void> {
  if (getConfig().queue.driver === 'sqlite') {
    return sqlite.shutdownPersistence();
  }
  return pg.shutdownPersistence();
}

export function getAuthProfileRepository() {
  if (getConfig().queue.driver === 'sqlite') {
    return sqlite.getAuthProfileRepository();
  }
  return pg.getAuthProfileRepository();
}

export function getTaskRunRepository() {
  const repo = getConfig().queue.driver === 'sqlite'
    ? sqlite.getTaskRunRepository()
    : pg.getTaskRunRepository();
  return wrapTaskRunRepository(repo);
}

export function getDbStatus() {
  if (getConfig().queue.driver === 'sqlite') {
    const status = sqlite.getDbStatus();
    return status ? { total: 1, idle: status.inTransaction ? 0 : 1, waiting: 0 } : null;
  }
  return pg.getPoolStatus();
}
