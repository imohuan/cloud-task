/**
 * 日志文件 Tail 监听器
 *
 * 基于文件追加事件驱动，可捕获任意进程/worker 写入的日志
 */

import chokidar from 'chokidar';
import type { FSWatcher } from 'chokidar';
import { EventEmitter } from 'events';
import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from 'fs';
import { join } from 'path';
import { LogPaths } from '../config';

export interface TailLogEvent {
  rawLine: string;
  timestamp: string;
}

/** 全局 tail 事件总线 - 供 SSE 路由订阅 */
export const tailEventBus = new EventEmitter();
tailEventBus.setMaxListeners(200);

let watcher: FSWatcher | null = null;
let currentFilePath = '';
/** 当前已读取到的文件字节偏移量 */
let position = 0;
/** 定期检查文件是否发生轮转的定时器 */
let watchRotationTimer: ReturnType<typeof setInterval> | null = null;

/** 获取当日日志文件路径 */
function getTodayLogFile(): string {
  const today = new Date().toISOString().split('T')[0];
  return join(LogPaths.dir, `app-${today}.log`);
}

/** 读取文件从当前偏移量起的新增内容，逐行 emit */
function readNewContent(filePath: string): void {
  if (!existsSync(filePath)) return;

  const stats = statSync(filePath);

  // 日志轮转/截断：文件缩小则从头读
  if (stats.size < position) {
    position = 0;
  }

  if (stats.size <= position) return;

  const stream = createReadStream(filePath, {
    start: position,
    end: stats.size - 1,
    encoding: 'utf8',
  });

  let buffer = '';

  stream.on('data', (chunk) => {
    buffer += chunk.toString();
  });

  stream.on('end', () => {
    position = stats.size;
    const lines = buffer.split('\n');
    for (const line of lines) {
      const trimmed = line.trimEnd();
      if (!trimmed) continue;
      const event: TailLogEvent = {
        rawLine: trimmed,
        timestamp: new Date().toISOString(),
      };
      tailEventBus.emit('log', event);
    }
  });

  stream.on('error', (err) => {
    console.error('[LogTail] 读取文件内容失败:', err);
  });
}

/** 重新启动 chokidar 监听 */
function restartWatcher(newFilePath: string): void {
  if (watcher) {
    watcher.close();
    watcher = null;
  }

  const filePath = newFilePath || LogPaths.file;
  if (!filePath) {
    console.error('[LogTail] 日志文件路径未初始化');
    return;
  }

  if (!existsSync(filePath)) {
    const dir = LogPaths.dir;
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(filePath, '', 'utf-8');
    console.log(`[LogTail] 日志文件不存在，已创建空文件: ${filePath}`);
  }

  currentFilePath = filePath;

  try {
    position = statSync(filePath).size;
  } catch {
    position = 0;
  }

  watcher = chokidar.watch(filePath, {
    persistent: true,
    usePolling: true,
    interval: 200,
    awaitWriteFinish: {
      stabilityThreshold: 100,
      pollInterval: 50,
    },
  });

  watcher
    .on('change', () => readNewContent(filePath))
    .on('add', () => {
      readNewContent(filePath);
    })
    .on('error', (err: any) => {
      console.error('[LogTail] 监听错误:', err);
    });

  console.log(`[LogTail] 开始监听日志文件: ${filePath}`);
}

/** 启动对当日日志文件的 tail 监听 */
export function startLogTail(): void {
  if (watcher) return;

  // 初始化 LogPaths
  if (!LogPaths.file) {
    LogPaths.init();
  }

  restartWatcher(LogPaths.file);

  // 启动定时检查文件轮转/跨天切换
  watchRotationTimer = setInterval(() => {
    const todayFile = getTodayLogFile();

    // 检查日期是否变化（跨天）
    if (todayFile !== currentFilePath) {
      console.log(`[LogTail] 日期变化，从 ${currentFilePath} 切换到 ${todayFile}`);
      restartWatcher(todayFile);
      return;
    }

    // 检查文件是否被截断或轮转
    try {
      const stat = statSync(currentFilePath);
      if (stat.size < position) {
        console.log(`[LogTail] 检测到文件轮转或截断，重新监听: ${currentFilePath}`);
        restartWatcher(currentFilePath);
      }
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        console.log(`[LogTail] 日志文件被删除，等待重建: ${currentFilePath}`);
        restartWatcher(currentFilePath);
      } else {
        console.error('[LogTail] 检查文件状态失败:', err);
      }
    }
  }, 5000);
}

/** 停止 tail 监听 */
export function stopLogTail(): void {
  if (watchRotationTimer) {
    clearInterval(watchRotationTimer);
    watchRotationTimer = null;
  }

  if (watcher) {
    watcher.close();
    watcher = null;
  }
  currentFilePath = '';
  position = 0;
  console.log('[LogTail] 已停止监听');
}
