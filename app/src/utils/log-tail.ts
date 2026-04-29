/**
 * 日志文件 Tail 监听器
 *
 * 基于文件追加事件驱动，可捕获任意进程/worker 写入的日志
 */

import { Tail } from 'tail';
import { EventEmitter } from 'events';
import { existsSync, mkdirSync, writeFileSync, statSync } from 'fs';
import { LogPaths } from '../config';

export interface TailLogEvent {
  rawLine: string;
  timestamp: string;
}

/** 全局 tail 事件总线 - 供 SSE 路由订阅 */
export const tailEventBus = new EventEmitter();
tailEventBus.setMaxListeners(200);

let tailInstance: Tail | null = null;
let currentFilePath = '';
let lastFileSize = 0;
/** 定期检查文件是否发生轮转的定时器 */
let watchRotationTimer: ReturnType<typeof setInterval> | null = null;

/** 获取当日日志文件路径 */
function getTodayLogFile(): string {
  const today = new Date().toISOString().split('T')[0];
  return join(LogPaths.dir, `app-${today}.log`);
}

// 动态导入 join 以避免循环依赖问题
import { join } from 'path';

/**
 * 检查文件是否发生了轮转（即 inode 发生变化或文件被截断）
 * 如果发生轮转，需要重新创建 Tail 实例
 */
function checkFileRotation(): boolean {
  if (!currentFilePath || !tailInstance) return false;

  try {
    const stat = statSync(currentFilePath);

    // 文件大小小于上次记录（文件被截断或轮转）
    if (stat.size < lastFileSize) {
      console.log(`[LogTail] 检测到文件轮转或截断，重新监听: ${currentFilePath}`);
      return true;
    }

    // 文件 inode 发生变化（文件被删除重建）
    // 这需要通过比较文件描述符或重新打开文件来检测
    // 简单方案：记录文件修改时间
    const mtimeMs = stat.mtimeMs;

    lastFileSize = stat.size;
    return false;
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      console.log(`[LogTail] 日志文件被删除，等待重建: ${currentFilePath}`);
      return true;
    }
    console.error('[LogTail] 检查文件状态失败:', err);
    return false;
  }
}

/** 重新启动 tail 监听 */
function restartTail(newFilePath: string): void {
  if (tailInstance) {
    tailInstance.unwatch();
    tailInstance = null;
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
    const stat = statSync(filePath);
    lastFileSize = stat.size;
  } catch {
    lastFileSize = 0;
  }

  tailInstance = new Tail(filePath, {
    fromBeginning: false,
    follow: true,
    useWatchFile: true,
    fsWatchOptions: { interval: 500 },
  });

  tailInstance.on('line', (line: string) => {
    const event: TailLogEvent = {
      rawLine: line,
      timestamp: new Date().toISOString(),
    };
    tailEventBus.emit('log', event);

    // 更新文件大小
    try {
      const stat = statSync(filePath);
      lastFileSize = stat.size;
    } catch {
      // ignore
    }
  });

  tailInstance.on('error', (error: any) => {
    console.error('[LogTail] 监听错误:', error);
    // 尝试恢复监听
    if (error.code === 'ENOENT') {
      setTimeout(() => {
        const todayFile = getTodayLogFile();
        if (existsSync(todayFile)) {
          restartTail(todayFile);
        }
      }, 1000);
    }
  });

  console.log(`[LogTail] 开始监听日志文件: ${filePath}`);
}

/** 启动对当日日志文件的 tail 监听 */
export function startLogTail(): void {
  if (tailInstance) return;

  // 初始化 LogPaths
  if (!LogPaths.file) {
    LogPaths.init();
  }

  restartTail(LogPaths.file);

  // 启动定时检查文件轮转
  watchRotationTimer = setInterval(() => {
    const todayFile = getTodayLogFile();

    // 检查日期是否变化（跨天）
    if (todayFile !== currentFilePath) {
      console.log(`[LogTail] 日期变化，从 ${currentFilePath} 切换到 ${todayFile}`);
      restartTail(todayFile);
      return;
    }

    // 检查文件是否发生轮转
    if (checkFileRotation()) {
      restartTail(currentFilePath);
    }
  }, 5000);
}

/** 停止 tail 监听 */
export function stopLogTail(): void {
  if (watchRotationTimer) {
    clearInterval(watchRotationTimer);
    watchRotationTimer = null;
  }

  if (tailInstance) {
    tailInstance.unwatch();
    tailInstance = null;
  }
  currentFilePath = '';
  lastFileSize = 0;
  console.log('[LogTail] 已停止监听');
}
