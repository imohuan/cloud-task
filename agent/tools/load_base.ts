import { tool } from "langchain";
import { z } from "zod";
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  type Dirent,
} from "fs";
import { resolve, join, dirname } from "path";
import { randomUUID } from "crypto";

// ─── Task 数据结构 ────────────────────────────────────────────────────────────

interface Task {
  id: string;
  title: string;
  description?: string;
  status: "pending" | "in_progress" | "completed" | "cancelled";
  priority: "low" | "medium" | "high";
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

type TaskStore = { tasks: Task[] };

// ─── 辅助函数 ─────────────────────────────────────────────────────────────────

function loadTasks(tasksFile: string): TaskStore {
  if (!existsSync(tasksFile)) return { tasks: [] };
  try {
    return JSON.parse(readFileSync(tasksFile, "utf-8")) as TaskStore;
  } catch {
    return { tasks: [] };
  }
}

function saveTasks(tasksFile: string, store: TaskStore): void {
  try {
    mkdirSync(dirname(tasksFile), { recursive: true });
    writeFileSync(tasksFile, JSON.stringify(store, null, 2), "utf-8");
  } catch (e) {
    throw new Error(`保存任务文件失败: ${(e as Error).message}`);
  }
}

// ─── 工厂函数 ─────────────────────────────────────────────────────────────────

export function createBaseTools(dirpath: string) {
  const baseDir = resolve(dirpath);

  // ── read_file ──────────────────────────────────────────────────────────────
  const readFileTool = tool(
    async ({ path: relPath }) => {
      try {
        const absPath = join(baseDir, relPath);
        if (!existsSync(absPath)) return `错误: 路径不存在 "${relPath}"`;
        const stat = statSync(absPath);
        if (stat.isDirectory()) {
          const entries = readdirSync(absPath, { withFileTypes: true }).map(
            (e: Dirent) => `${e.isDirectory() ? "[dir] " : "[file]"} ${e.name}`
          );
          return entries.join("\n") || "(空目录)";
        }
        return readFileSync(absPath, "utf-8");
      } catch (e) {
        return `错误: 读取文件失败 "${relPath}" — ${(e as Error).message}`;
      }
    },
    {
      name: "read_file",
      description:
        "读取基础目录下的文件内容，或列出目录中的条目。路径为相对路径。",
      schema: z.object({
        path: z.string().describe("相对于基础目录的路径，例如 'notes/todo.md'"),
      }),
    }
  );

  // ── write_file ─────────────────────────────────────────────────────────────
  const writeFileTool = tool(
    async ({ path: relPath, content, append }) => {
      try {
        const absPath = join(baseDir, relPath);
        mkdirSync(dirname(absPath), { recursive: true });
        if (append && existsSync(absPath)) {
          const existing = readFileSync(absPath, "utf-8");
          writeFileSync(absPath, existing + content, "utf-8");
        } else {
          writeFileSync(absPath, content, "utf-8");
        }
        return `已${append ? "追加写入" : "写入"} "${relPath}"`;
      } catch (e) {
        return `错误: 写入文件失败 "${relPath}" — ${(e as Error).message}`;
      }
    },
    {
      name: "write_file",
      description:
        "向基础目录下的文件写入内容（覆盖或追加），不存在时自动创建。路径为相对路径。",
      schema: z.object({
        path: z.string().describe("相对于基础目录的路径"),
        content: z.string().describe("要写入的文本内容"),
        append: z
          .boolean()
          .optional()
          .describe("true 表示追加，false/不填 表示覆盖"),
      }),
    }
  );

  // ── edit_file ──────────────────────────────────────────────────────────────
  const editFileTool = tool(
    async ({ path: relPath, old_string, new_string, replace_all }) => {
      try {
        const absPath = join(baseDir, relPath);
        if (!existsSync(absPath)) return `错误: 文件不存在 "${relPath}"`;
        const content = readFileSync(absPath, "utf-8");
        const occurrences = content.split(old_string).length - 1;
        if (occurrences === 0)
          return `错误: 在 "${relPath}" 中未找到指定内容，请确认原始文本是否正确`;
        if (!replace_all && occurrences > 1)
          return `错误: 在 "${relPath}" 中找到 ${occurrences} 处匹配，内容不唯一。请在 old_string 中提供更多上下文以唯一定位，或将 replace_all 设为 true`;
        const updated = replace_all
          ? content.split(old_string).join(new_string)
          : content.replace(old_string, new_string);
        writeFileSync(absPath, updated, "utf-8");
        return `已编辑 "${relPath}"，共替换 ${replace_all ? occurrences : 1} 处`;
      } catch (e) {
        return `错误: 编辑文件失败 "${relPath}" — ${(e as Error).message}`;
      }
    },
    {
      name: "edit_file",
      description:
        "对文件中的特定文本进行精确替换，适合编辑大文件的局部内容。提供原始文本（old_string）和替换后内容（new_string）。若原始文本在文件中不唯一，需在 old_string 中包含更多上下文，或将 replace_all 设为 true 替换全部匹配。",
      schema: z.object({
        path: z.string().describe("相对于基础目录的文件路径"),
        old_string: z
          .string()
          .describe(
            "要查找的原始文本，必须与文件内容完全匹配（包括空格和换行）。若文件中有多处相同内容，需提供足够上下文使其唯一"
          ),
        new_string: z.string().describe("替换后的新文本"),
        replace_all: z
          .boolean()
          .optional()
          .describe(
            "true 表示替换所有匹配项；false 或不填表示只替换第一处（此时要求内容唯一）"
          ),
      }),
    }
  );

  // ── 共享 Task Schema ────────────────────────────────────────────────────────
  const taskItemSchema = z.object({
    id: z.string().optional().describe("任务的 UUID，新建时无需传入"),
    title: z.string().optional().describe("任务标题"),
    description: z.string().optional().describe("任务详细描述"),
    status: z
      .enum(["pending", "in_progress", "completed", "cancelled"])
      .optional()
      .describe("任务状态"),
    priority: z
      .enum(["low", "medium", "high"])
      .optional()
      .describe("优先级，默认 medium"),
    tags: z.array(z.string()).optional().describe("标签列表"),
  });

  // ── create_task ────────────────────────────────────────────────────────────
  const createTaskTool = tool(
    async ({ tasks }, config) => {
      const thread_id = config.metadata.thread_id
      const tasksFile = join(baseDir, `tasks-${thread_id}.json`);
      const store = loadTasks(tasksFile);
      const now = new Date().toISOString();
      const createdTasks: Task[] = tasks.map((t: any) => ({
        id: randomUUID(),
        title: t.title,
        description: t.description,
        status: "pending",
        priority: t.priority ?? "medium",
        tags: t.tags,
        createdAt: now,
        updatedAt: now,
      }));
      store.tasks.push(...createdTasks);
      saveTasks(tasksFile, store);
      return JSON.stringify(store, null, 2);
    },
    {
      name: "create_tasks",
      description: "在 tasks.json 中批量创建新任务，返回完整的任务列表。",
      schema: z.object({
        tasks: z.array(taskItemSchema),
      }),
    }
  );

  // ── list_tasks ─────────────────────────────────────────────────────────────
  const listTasksTool = tool(
    async (_args, config) => {
      const thread_id = config.metadata.thread_id;
      const tasksFile = join(baseDir, `tasks-${thread_id}.json`);
      const store = loadTasks(tasksFile);
      return JSON.stringify(store, null, 2);
    },
    {
      name: "list_tasks",
      description: "列出 tasks.json 中的所有任务，返回完整的任务列表。",
      schema: z.object({
        tasks: z.array(taskItemSchema),
      }),
    }
  );

  // ── update_tasks ───────────────────────────────────────────────────────────
  const updateTasksTool = tool(
    async ({ tasks }, config) => {
      const thread_id = config.metadata.thread_id;
      const tasksFile = join(baseDir, `tasks-${thread_id}.json`);
      const store = loadTasks(tasksFile);
      const now = new Date().toISOString();

      for (const update of tasks) {
        const idx = store.tasks.findIndex((t) => t.id === update.id);
        if (idx === -1) continue;
        const task = store.tasks[idx];
        if (update.title !== undefined) task.title = update.title;
        if (update.description !== undefined) task.description = update.description;
        if (update.status !== undefined) task.status = update.status;
        if (update.priority !== undefined) task.priority = update.priority;
        if (update.tags !== undefined) task.tags = update.tags;
        task.updatedAt = now;
      }

      saveTasks(tasksFile, store);
      return JSON.stringify(store, null, 2);
    },
    {
      name: "update_tasks",
      description: "批量修改任务字段，支持同时修改多个任务。只需传入要修改的任务 id 和相应字段。返回完整的任务列表。",
      schema: z.object({
        tasks: z.array(taskItemSchema),
      }),
    }
  );

  // ── delete_tasks ───────────────────────────────────────────────────────────
  const deleteTasksTool = tool(
    async ({ tasks }, config) => {
      const thread_id = config.metadata.thread_id;
      const tasksFile = join(baseDir, `tasks-${thread_id}.json`);
      const store = loadTasks(tasksFile);
      const ids = tasks.map((t) => t.id);
      store.tasks = store.tasks.filter((t) => !ids.includes(t.id));
      saveTasks(tasksFile, store);
      return JSON.stringify(store, null, 2);
    },
    {
      name: "delete_tasks",
      description: "从 tasks.json 中批量永久删除指定任务，返回完整的任务列表。",
      schema: z.object({
        tasks: z.array(taskItemSchema),
      }),
    }
  );

  return [
    readFileTool,
    writeFileTool,
    editFileTool,
    createTaskTool,
    listTasksTool,
    updateTasksTool,
    deleteTasksTool,
  ];
}
