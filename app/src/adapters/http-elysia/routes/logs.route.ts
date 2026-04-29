/**
 * 日志路由
 *
 * 提供日志文件列表查询和内容查看接口
 */

import { Elysia, t, sse } from "elysia";
import { readdir, readFile, stat } from "fs/promises";
import { existsSync } from "fs";
import { createFileTailWatcher } from "../../../utils/log-tail";
import { join, basename } from "path";
import { Logger } from "../../../utils/logger";
import { matchesLogFilter } from "../../../utils/log-filter";
import { getConfig, LogPaths } from "../../../config";
import { getAppRoot } from "../../../utils/app-root";

const logger = new Logger("LogsRoute");


/** 日志目录路径 */
const LOG_DIR = getConfig().log.logDir || join(getAppRoot(), "logs");

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
        const content = await readFile(filePath, "utf-8");
        let allLines = content.split("\n").filter((line) => line.trim());

        // 应用过滤条件
        allLines = allLines.filter((line) => matchesLogFilter(line, { levels, search, exclude }));

        return {
          success: true,
          data: {
            filename,
            size: fileStats.size,
            sizeFormatted: formatFileSize(fileStats.size),
            modifiedAt: fileStats.mtime.toISOString(),
            totalLines: allLines.length,
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

        // 读取文件内容
        const content = await readFile(filePath, "utf-8");
        let allLines = content.split("\n").filter((line) => line.trim());

        // 应用过滤条件
        allLines = allLines.filter((line) => matchesLogFilter(line, { levels, search, exclude }));

        const maxLines = parseInt(lines, 10) || 100;
        const totalLines = allLines.length;
        let paginatedLines: string[] = [];

        // 如果指定了 after 参数，获取该位置之后的日志（用于获取新日志）
        if (after !== undefined) {
          const afterLine = parseInt(after, 10) || 0;
          const startIndex = afterLine;
          const endIndex = Math.min(startIndex + maxLines, totalLines);
          paginatedLines = allLines.slice(startIndex, endIndex);
        } else {
          // 原有的分页逻辑（从末尾往前取）
          const startOffset = parseInt(offset, 10) || 0;
          const startIndex = Math.max(0, totalLines - maxLines - startOffset);
          const endIndex = Math.max(0, totalLines - startOffset);
          paginatedLines = allLines.slice(startIndex, endIndex);
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

      const filePath = LogPaths.file;

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
  );
