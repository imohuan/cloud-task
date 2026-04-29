/**
 * 日志文件 Tail 监听器
 *
 * 基于文件追加事件驱动，可捕获任意进程/worker 写入的日志
 */

import chokidar from 'chokidar';
import { EventEmitter } from 'events';
import { createReadStream, existsSync, statSync } from 'fs';

// ---- 可复用的单文件 tail 监听器 ----

/** 单文件 tail 监听器接口 */
export interface TailWatcher {
  on(event: 'line', listener: (line: string) => void): this;
  off(event: 'line', listener: (line: string) => void): this;
  close(): void;
}

class TailWatcherImpl extends EventEmitter implements TailWatcher {
  private chokidarWatcher: ReturnType<typeof chokidar.watch>;
  private position: number;

  constructor(private filePath: string) {
    super();
    this.position = 0;
    try {
      if (existsSync(filePath)) this.position = statSync(filePath).size;
    } catch {
      this.position = 0;
    }

    this.chokidarWatcher = chokidar.watch(filePath, {
      persistent: true,
      usePolling: true,
      interval: 200,
      awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
    });

    this.chokidarWatcher
      .on('change', () => this._readNewContent())
      .on('add', () => this._readNewContent())
      .on('error', (err: any) => console.error('[TailWatcher] 监听错误:', err));
  }

  private _readNewContent(): void {
    if (!existsSync(this.filePath)) return;
    try {
      const stats = statSync(this.filePath);
      if (stats.size < this.position) this.position = 0;
      if (stats.size <= this.position) return;

      const stream = createReadStream(this.filePath, {
        start: this.position,
        end: stats.size - 1,
        encoding: 'utf8',
      });
      let buffer = '';
      stream.on('data', (chunk) => { buffer += chunk.toString(); });
      stream.on('end', () => {
        this.position = stats.size;
        for (const line of buffer.split('\n')) {
          const trimmed = line.trimEnd();
          if (trimmed) this.emit('line', trimmed);
        }
      });
      stream.on('error', (err) => {
        console.error('[TailWatcher] 读取文件内容失败:', err);
      });
    } catch (err) {
      console.error('[TailWatcher] 文件状态检查失败:', err);
    }
  }

  close(): void {
    this.chokidarWatcher.close();
    this.removeAllListeners();
  }
}

/** 创建单文件 tail 监听器，从文件末尾开始监听新增内容 */
export function createFileTailWatcher(filePath: string): TailWatcher {
  return new TailWatcherImpl(filePath);
}

