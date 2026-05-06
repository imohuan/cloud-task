/**
 * 日志路由
 *
 * 提供日志文件列表查询和内容查看接口
 */

import { Elysia, t, sse } from "elysia";
import { readdir, readFile, stat } from "fs/promises";
import { existsSync, createReadStream } from "fs";
import { createInterface } from "readline";
import { createFileTailWatcher } from "../../../utils/log-tail";
import { join, basename } from "path";
import { Logger, getLogFilePath } from "../../../utils/logger";
import { matchesLogFilter } from "../../../utils/log-filter";
import { getConfig } from "../../../config";

const logger = new Logger("LogsRoute");


/** 日志目录路径 */
const LOG_DIR = getConfig().log.logDir;

/** 日志文件信息 */
interface LogFileInfo {
  name: string;
  size: number;
  sizeFormatted: string;
  modifiedAt: string;
}

/** 格式化文件大小 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * 日志路由
 * 提供日志文件列表和内容查看接口
 */
export const logsRoutes = new Elysia({ prefix: "/api/logs" })
  // 获取日志文件列表
  .get(
    "/",
    async () => {
      try {
        const files = await readdir(LOG_DIR);
        const logFiles: LogFileInfo[] = [];

        for (const name of files) {
          if (name.endsWith(".log")) {
            const filePath = join(LOG_DIR, name);
            const stats = await stat(filePath);
            logFiles.push({
              name,
              size: stats.size,
              sizeFormatted: formatFileSize(stats.size),
              modifiedAt: stats.mtime.toISOString(),
            });
          }
        }

        // 按修改时间倒序排列
        logFiles.sort(
          (a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime(),
        );

        logger.debug(`获取日志列表成功，共 ${logFiles.length} 个文件`);

        return {
          success: true,
          data: {
            logDir: LOG_DIR,
            files: logFiles,
          },
        };
      } catch (error: any) {
        logger.error("获取日志列表失败", error);
        return {
          success: false,
          error: {
            code: "LIST_LOGS_FAILED",
            message: error.message || "获取日志列表失败",
          },
        };
      }
    },
    {
      detail: {
        summary: "获取日志文件列表",
        tags: ["logs"],
      },
    },
  )

  // 获取单个日志文件状态（总行数等）
  .get(
    "/status/:filename",
    async ({ params, query }) => {
      const { filename } = params;
      const { search, exclude, levels } = query as {
        search?: string;
        exclude?: string;
        levels?: string;
      };

      // 安全检查
      if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
        return {
          success: false,
          error: { code: "INVALID_FILENAME", message: "无效的文件名" },
        };
      }
      if (!filename.endsWith(".log")) {
        return {
          success: false,
          error: { code: "INVALID_FILE_TYPE", message: "只允许访问 .log 文件" },
        };
      }

      try {
        const filePath = join(LOG_DIR, filename);
        const fileStats = await stat(filePath);

        let totalLines = 0;
        await new Promise<void>((resolve) => {
          const rl = createInterface({
            input: createReadStream(filePath, { encoding: "utf-8" }),
            crlfDelay: Infinity,
          });
          rl.on("line", (line) => {
            if (!line.trim()) return;
            if (!matchesLogFilter(line, { levels, search, exclude })) return;
            totalLines++;
          });
          rl.on("close", resolve);
          rl.on("error", () => resolve());
        });

        return {
          success: true,
          data: {
            filename,
            size: fileStats.size,
            sizeFormatted: formatFileSize(fileStats.size),
            modifiedAt: fileStats.mtime.toISOString(),
            totalLines,
          },
        };
      } catch (error: any) {
        if (error.code === "ENOENT") {
          return {
            success: false,
            error: { code: "FILE_NOT_FOUND", message: "日志文件不存在" },
          };
        }
        logger.error(`获取日志状态失败: ${filename}`, error);
        return {
          success: false,
          error: { code: "READ_LOG_FAILED", message: error.message || "读取失败" },
        };
      }
    },
    {
      params: t.Object({ filename: t.String() }),
      query: t.Object({
        search: t.Optional(t.String()),
        exclude: t.Optional(t.String()),
        levels: t.Optional(t.String()),
      }),
      detail: {
        summary: "获取日志文件状态",
        tags: ["logs"],
      },
    },
  )

  // SSE 实时日志流（指定文件）
  .get(
    "/:filename/sse",
    async function* ({ params, query, request }) {
      const { filename } = params;
      const { search, exclude, levels } = query as {
        search?: string;
        exclude?: string;
        levels?: string;
      };
      const { signal } = request;

      // 安全检查
      if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
        yield sse({ data: { error: "无效的文件名" } });
        return;
      }
      if (!filename.endsWith(".log")) {
        yield sse({ data: { error: "只允许访问 .log 文件" } });
        return;
      }

      const filePath = join(LOG_DIR, filename);

      if (!existsSync(filePath)) {
        yield sse({ data: { error: "日志文件不存在" } });
        return;
      }

      const fileWatcher = createFileTailWatcher(filePath);

      const queue: string[] = [];
      let notify: (() => void) | null = null;

      fileWatcher.on("line", (line) => {
        if (!matchesLogFilter(line, { levels, search, exclude })) return;
        queue.push(line);
        if (notify) {
          notify();
          notify = null;
        }
      });

      yield sse({ event: "ping", data: { time: Date.now() } });

      try {
        while (!signal.aborted) {
          if (queue.length === 0) {
            let resolved = false;
            await Promise.race([
              new Promise<void>((resolve) => {
                notify = () => {
                  if (!resolved) {
                    resolved = true;
                    resolve();
                  }
                };
              }),
              new Promise<void>((resolve) => {
                const timer = setTimeout(() => {
                  if (!resolved) {
                    resolved = true;
                    resolve();
                  }
                }, 10000);
                signal.addEventListener(
                  "abort",
                  () => {
                    clearTimeout(timer);
                    if (!resolved) {
                      resolved = true;
                      resolve();
                    }
                  },
                  { once: true },
                );
              }),
            ]);
            notify = null;
            if (signal.aborted) break;
            if (queue.length === 0) {
              yield sse({ event: "ping", data: { time: Date.now() } });
              continue;
            }
          }

          const line = queue.shift()!;
          yield sse({ data: { rawLine: line, timestamp: new Date().toISOString() } });
        }
      } finally {
        fileWatcher.close();
      }
    },
    {
      params: t.Object({ filename: t.String() }),
      query: t.Object({
        search: t.Optional(t.String()),
        exclude: t.Optional(t.String()),
        levels: t.Optional(t.String()),
      }),
      detail: {
        summary: "SSE 实时日志流（指定文件）",
        tags: ["logs"],
      },
    },
  )

  // SSE 实时日志流
  .get(
    "/sse",
    async function* ({ query, request }) {
      const { search, exclude, levels } = query as {
        search?: string;
        exclude?: string;
        levels?: string;
      };
      const { signal } = request;

      let filePath = getLogFilePath();

      if (!existsSync(filePath)) {
        yield sse({ data: { error: "日志文件不存在" } });
        return;
      }

      let fileWatcher = createFileTailWatcher(filePath);

      const queue: string[] = [];
      let notify: (() => void) | null = null;

      const attachWatcher = (watcher: ReturnType<typeof createFileTailWatcher>) => {
        watcher.on("line", (line) => {
          if (!matchesLogFilter(line, { levels, search, exclude })) return;
          queue.push(line);
          if (notify) {
            notify();
            notify = null;
          }
        });
      };

      attachWatcher(fileWatcher);

      yield sse({ event: "ping", data: { time: Date.now() } });

      try {
        while (!signal.aborted) {
          // 检测跨日日志轮转，切换到新文件
          const newFilePath = getLogFilePath();
          if (newFilePath !== filePath && existsSync(newFilePath)) {
            fileWatcher.close();
            filePath = newFilePath;
            fileWatcher = createFileTailWatcher(filePath);
            attachWatcher(fileWatcher);
          }

          if (queue.length === 0) {
            let resolved = false;
            await Promise.race([
              new Promise<void>((resolve) => {
                notify = () => {
                  if (!resolved) {
                    resolved = true;
                    resolve();
                  }
                };
              }),
              new Promise<void>((resolve) => {
                const timer = setTimeout(() => {
                  if (!resolved) {
                    resolved = true;
                    resolve();
                  }
                }, 10000);
                signal.addEventListener(
                  "abort",
                  () => {
                    clearTimeout(timer);
                    if (!resolved) {
                      resolved = true;
                      resolve();
                    }
                  },
                  { once: true },
                );
              }),
            ]);
            notify = null;
            if (signal.aborted) break;
            if (queue.length === 0) {
              yield sse({ event: "ping", data: { time: Date.now() } });
              continue;
            }
          }

          const line = queue.shift()!;
          yield sse({ data: { rawLine: line, timestamp: new Date().toISOString() } });
        }
      } finally {
        fileWatcher.close();
      }
    },
    {
      query: t.Object({
        search: t.Optional(t.String()),
        exclude: t.Optional(t.String()),
        levels: t.Optional(t.String()),
      }),
      detail: {
        summary: "SSE 实时日志流",
        tags: ["logs"],
      },
    },
  )

  // 按时间范围获取日志（跨多个日志文件）
  .get(
    "/by-time",
    async ({ query }) => {
      const {
        startTime,
        endTime,
        offsetMinutes = "10",
        search,
        exclude,
        levels,
        lines = "2000",
      } = query as {
        startTime?: string;
        endTime?: string;
        offsetMinutes?: string;
        search?: string;
        exclude?: string;
        levels?: string;
        lines?: string;
      };

      if (!startTime) {
        return {
          success: false,
          error: { code: "MISSING_START_TIME", message: "startTime 参数必须提供" },
        };
      }

      const startMs = parseInt(startTime, 10);
      const offsetMs = (parseInt(offsetMinutes, 10) || 10) * 60 * 1000;
      const effectiveStart = startMs - offsetMs;
      const effectiveEnd = endTime ? parseInt(endTime, 10) + offsetMs : Date.now();
      const maxLines = parseInt(lines, 10) || 2000;

      /** 将 ms 时间戳转为 YYYY-MM-DD（UTC，与文件名一致） */
      const toUtcDateStr = (ms: number) => new Date(ms).toISOString().split("T")[0]!;

      /** 枚举 effectiveStart 到 effectiveEnd 的所有 UTC 日期字符串（归一化到 UTC 00:00 避免时间部分干扰循环边界） */
      const toUtcDayStart = (ms: number) => {
        const d = new Date(ms);
        return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
      };
      const dateCursor = new Date(toUtcDayStart(effectiveStart));
      const dateEnd = new Date(toUtcDayStart(effectiveEnd));
      const targetDates = new Set<string>();
      while (dateCursor <= dateEnd) {
        targetDates.add(toUtcDateStr(dateCursor.getTime()));
        dateCursor.setUTCDate(dateCursor.getUTCDate() + 1);
      }

      try {
        const allFiles = await readdir(LOG_DIR);
        const matchedFiles = allFiles
          .filter((name) => {
            if (!name.endsWith(".log")) return false;
            const m = name.match(/^app-(\d{4}-\d{2}-\d{2})\.log$/);
            return m ? targetDates.has(m[1]!) : false;
          })
          .sort(); // 按日期升序处理

        const resultLines: string[] = [];

        for (const filename of matchedFiles) {
          try {
            await new Promise<void>((resolve) => {
              const rl = createInterface({
                input: createReadStream(join(LOG_DIR, filename), { encoding: "utf-8" }),
                crlfDelay: Infinity,
              });
              rl.on("line", (line) => {
                if (!line.trim()) return;
                // 解析行首时间戳 "YYYY-MM-DD HH:mm:ss.SSS"（本地时间）
                const tsStr = line.substring(0, 23);
                const lineTime = new Date(tsStr).getTime();
                if (!isNaN(lineTime)) {
                  if (lineTime < effectiveStart || lineTime > effectiveEnd) return;
                }
                if (!matchesLogFilter(line, { levels, search, exclude })) return;
                resultLines.push(line);
              });
              rl.on("close", resolve);
              rl.on("error", () => resolve());
            });
          } catch {
            // 单文件读取失败不影响整体
          }
        }

        // 截取末尾 maxLines 条
        const sliced = resultLines.length > maxLines ? resultLines.slice(-maxLines) : resultLines;

        return {
          success: true,
          data: {
            lines: sliced,
            total: resultLines.length,
            effectiveStart: new Date(effectiveStart).toISOString(),
            effectiveEnd: new Date(effectiveEnd).toISOString(),
            scannedFiles: matchedFiles,
          },
        };
      } catch (error: any) {
        logger.error("按时间范围读取日志失败", error);
        return {
          success: false,
          error: { code: "READ_BY_TIME_FAILED", message: error.message || "读取失败" },
        };
      }
    },
    {
      query: t.Object({
        startTime: t.Optional(t.String()),
        endTime: t.Optional(t.String()),
        offsetMinutes: t.Optional(t.String()),
        search: t.Optional(t.String()),
        exclude: t.Optional(t.String()),
        levels: t.Optional(t.String()),
        lines: t.Optional(t.String()),
      }),
      detail: {
        summary: "按时间范围获取日志（跨多个日志文件）",
        tags: ["logs"],
      },
    },
  )

  // 获取单个日志文件内容
  .get(
    "/:filename",
    async ({ params, query }) => {
      const { filename } = params;
      const {
        lines = "100",
        offset = "0",
        after,
        search,
        exclude,
        levels,
      } = query as {
        lines?: string;
        offset?: string;
        after?: string;
        search?: string;
        exclude?: string;
        levels?: string;
      };

      // 安全检查：防止目录遍历攻击
      if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
        return {
          success: false,
          error: {
            code: "INVALID_FILENAME",
            message: "无效的文件名",
          },
        };
      }

      // 只允许访问 .log 文件
      if (!filename.endsWith(".log")) {
        return {
          success: false,
          error: {
            code: "INVALID_FILE_TYPE",
            message: "只允许访问 .log 文件",
          },
        };
      }

      try {
        const filePath = join(LOG_DIR, filename);
        const fileStats = await stat(filePath);

        const maxLines = parseInt(lines, 10) || 100;
        let totalLines = 0;
        let paginatedLines: string[] = [];

        if (after !== undefined) {
          // after 模式：收集指定位置之后的最多 maxLines 行，同时统计总行数
          const afterLine = parseInt(after, 10) || 0;
          await new Promise<void>((resolve) => {
            const rl = createInterface({
              input: createReadStream(filePath, { encoding: "utf-8" }),
              crlfDelay: Infinity,
            });
            rl.on("line", (line) => {
              if (!line.trim()) return;
              if (!matchesLogFilter(line, { levels, search, exclude })) return;
              if (totalLines >= afterLine && paginatedLines.length < maxLines) {
                paginatedLines.push(line);
              }
              totalLines++;
            });
            rl.on("close", resolve);
            rl.on("error", () => resolve());
          });
        } else {
          // 末尾分页模式：滑动窗口，仅保留最后 (maxLines + startOffset) 行，避免全量加载
          const startOffset = parseInt(offset, 10) || 0;
          const needed = maxLines + startOffset;
          const window: string[] = [];
          await new Promise<void>((resolve) => {
            const rl = createInterface({
              input: createReadStream(filePath, { encoding: "utf-8" }),
              crlfDelay: Infinity,
            });
            rl.on("line", (line) => {
              if (!line.trim()) return;
              if (!matchesLogFilter(line, { levels, search, exclude })) return;
              window.push(line);
              if (window.length > needed) window.shift();
              totalLines++;
            });
            rl.on("close", resolve);
            rl.on("error", () => resolve());
          });
          const endIdx = Math.max(0, window.length - startOffset);
          paginatedLines = window.slice(Math.max(0, endIdx - maxLines), endIdx);
        }

        logger.debug(
          `读取日志文件: ${filename}, 总行数: ${totalLines}, 返回: ${paginatedLines.length} 行, after: ${after}`,
        );

        return {
          success: true,
          data: {
            filename,
            size: fileStats.size,
            sizeFormatted: formatFileSize(fileStats.size),
            modifiedAt: fileStats.mtime.toISOString(),
            totalLines,
            returnedLines: paginatedLines.length,
            offset: after !== undefined ? 0 : parseInt(offset, 10) || 0,
            lines: paginatedLines,
          },
        };
      } catch (error: any) {
        if (error.code === "ENOENT") {
          return {
            success: false,
            error: {
              code: "FILE_NOT_FOUND",
              message: "日志文件不存在",
            },
          };
        }

        logger.error(`读取日志文件失败: ${filename}`, error);
        return {
          success: false,
          error: {
            code: "READ_LOG_FAILED",
            message: error.message || "读取日志文件失败",
          },
        };
      }
    },
    {
      params: t.Object({
        filename: t.String(),
      }),
      query: t.Object({
        lines: t.Optional(t.String()),
        offset: t.Optional(t.String()),
        after: t.Optional(t.String()),
        search: t.Optional(t.String()),
        exclude: t.Optional(t.String()),
        levels: t.Optional(t.String()),
      }),
      detail: {
        summary: "获取日志文件内容",
        tags: ["logs"],
      },
    },
  );
