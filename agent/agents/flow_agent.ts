/**
 * Flow Agent —— 状态机驱动的任务执行 Agent
 *
 * 设计原则（针对原版冗余循环的优化）：
 *   1. 任务调度器（scheduler）：每轮只挑一个 pending 任务交给 executor，
 *      不再让 LLM 自己决定"做哪一个"。
 *   2. 验收门槛（validator）：每个任务由独立 LLM 判断 pass/fail，
 *      失败带反馈进入 retry，超过 MAX_RETRIES 标记 cancelled 后跳过。
 *   3. 规划只跑一次（planner）：检查磁盘上的 tasks 文件，已存在则跳过。
 *   4. 上下文压缩（compress）：messages 超阈值时，老消息压成 summary，
 *      用 RemoveMessage 真删掉，避免 token 雪球。
 *   5. 状态化执行：executor 只看 task 字段 + summary + 最近 KEEP_RECENT 条消息，
 *      不喂全部历史。
 *   6. 工具白名单分层：planner 只能 create_tasks；executor 看不到任何
 *      任务管理工具，状态完全由 graph 管。
 *   7. 终止条件基于"无 pending 任务"，不再用 [已完成] 文本匹配。
 */

import { initChatModel } from "langchain";
import {
    StateGraph,
    END,
    START,
    Annotation,
    messagesStateReducer,
} from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import {
    AIMessage,
    HumanMessage,
    SystemMessage,
    RemoveMessage,
    type BaseMessage,
} from "@langchain/core/messages";
import {
    searchTool,
    createLoadMcpTool,
    createLoadSkillTool,
    createBaseTools,
} from "../tools/index";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { existsSync, mkdirSync, readFileSync } from "fs";

// ─── 路径与工具集 ────────────────────────────────────────────────────────────
const WORKSPACE_DIR = join(dirname(fileURLToPath(import.meta.url)), "../workspace");
if (!existsSync(WORKSPACE_DIR)) mkdirSync(WORKSPACE_DIR);
const BASE_DIR = join(WORKSPACE_DIR, "base");

if (!process.env.OPENAI_MODEL) {
    throw new Error("OPENAI_MODEL is not set");
}

const tools = [
    createLoadSkillTool(join(WORKSPACE_DIR, "skills")),
    searchTool,
    ...(await createLoadMcpTool()),
    ...createBaseTools(BASE_DIR),
];

const TASK_TOOL_NAMES = new Set([
    "create_tasks",
    "update_tasks",
    "delete_tasks",
    "list_tasks",
]);
const planTools = tools.filter((t) => t.name === "create_tasks");
const execTools = tools.filter((t) => !TASK_TOOL_NAMES.has(t.name));
const updateTasksTool = tools.find((t) => t.name === "update_tasks")!;

// ─── 模型 ────────────────────────────────────────────────────────────────────
const model = await initChatModel(process.env.OPENAI_MODEL, {
    modelProvider: "openai",
    baseUrl: process.env.OPENAI_BASE_URL,
    apiKey: process.env.OPENAI_API_KEY,
    thinking: { type: "enabled", budget_tokens: 10000 },
    reasoning_effort: "high",
});

// 轻量模型用于压缩/验收（避免高推理成本）
const lightModel = await initChatModel(process.env.OPENAI_MODEL, {
    modelProvider: "openai",
    baseUrl: process.env.OPENAI_BASE_URL,
    apiKey: process.env.OPENAI_API_KEY,
});

// 强制 planner 必须调用 create_tasks，避免模型只输出文本计划就结束
const plannerModel = model.bindTools(planTools, {
    tool_choice: { type: "function", function: { name: "create_tasks" } },
});
const executorModel = model.bindTools(execTools);

// ─── Task 类型与磁盘读取 ─────────────────────────────────────────────────────
interface Task {
    id: string;
    title: string;
    description?: string;
    status: "pending" | "in_progress" | "completed" | "cancelled";
    priority: string;
    tags?: string[];
    createdAt: string;
    updatedAt: string;
}

function getThreadId(config: any): string {
    return (
        config?.configurable?.thread_id ??
        config?.metadata?.thread_id ??
        "default"
    );
}

function readTasksFile(threadId: string): Task[] {
    const file = join(BASE_DIR, `tasks-${threadId}.json`);
    if (!existsSync(file)) return [];
    try {
        const json = JSON.parse(readFileSync(file, "utf-8"));
        return (json.tasks ?? []) as Task[];
    } catch {
        return [];
    }
}

function pickNextTask(tasks: Task[]): Task | null {
    return (
        tasks.find((t) => t.status === "in_progress") ??
        tasks.find((t) => t.status === "pending") ??
        null
    );
}

async function markTaskStatus(
    threadId: string,
    id: string,
    status: Task["status"],
) {
    const cfg = {
        configurable: { thread_id: threadId },
        metadata: { thread_id: threadId },
    };
    await (updateTasksTool as any).invoke({ tasks: [{ id, status }] }, cfg);
}

// ─── State ───────────────────────────────────────────────────────────────────
const AgentState = Annotation.Root({
    messages: Annotation<BaseMessage[]>({
        reducer: messagesStateReducer,
        default: () => [],
    }),
    currentTaskId: Annotation<string | null>({
        reducer: (_, n) => n,
        default: () => null,
    }),
    retries: Annotation<number>({
        reducer: (_, n) => n,
        default: () => 0,
    }),
    summary: Annotation<string>({
        reducer: (_, n) => n,
        default: () => "",
    }),
    lastVerdict: Annotation<{ pass: boolean; reason: string } | null>({
        reducer: (_, n) => n,
        default: () => null,
    }),
});
type S = typeof AgentState.State;

// ─── 调参常量 ────────────────────────────────────────────────────────────────
const MAX_MESSAGES = 24; // 触发压缩阈值
const KEEP_RECENT = 8; // 压缩时保留尾部消息数
const MAX_RETRIES = 2; // 单任务最大重试次数

// ─── Prompts ─────────────────────────────────────────────────────────────────
const PLANNER_PROMPT = `# 角色
你是任务规划器。**本轮你必须调用 create_tasks 工具**创建一份最小可执行任务清单，禁止只输出文字计划。

# 硬性规则
1. **每个任务必须可验证**：description 中必须写明"验收标准"（如：文件 X 存在 / 包含字段 Y / 内容覆盖功能 Z）。
2. **避免润色式拆分**：禁止把同一交付物拆成"生成→润色→再润色"。一个交付物 = 一个任务，一次产出完整版本。
3. **覆盖式产物优先**：写文件用 write_file 一次性产出，避免反复 edit_file。
4. **粒度 3-7 项**，每项独立可交付。
5. 若用户需求有歧义，**也要先创建任务**：把澄清/调研作为第一个任务（如 "调研用户具体需求并产出方案文档"），而不是不调用工具。
6. 创建完任务后**直接结束本轮回复**，不要再额外执行——后续由调度器自动驱动。`;

const buildExecutorPrompt = (task: Task, summary: string, retryHint: string) => `# 角色
你是任务执行器，**当前只负责完成下面这一个任务**。不要看其它任务，不要重新规划，不要调用任何任务管理工具（create/update/list/delete_tasks 已被禁用）。

# 当前任务
- id: ${task.id}
- title: ${task.title}
- description: ${task.description ?? "(无额外描述)"}

# 历史摘要
${summary || "(无)"}
${retryHint ? `\n# 上一次验收反馈\n${retryHint}\n` : ""}
# 执行规则
1. 调用必要工具完成本任务（read_file / write_file / edit_file / search 等）。
2. **覆盖式生成优先**：能 write_file 一次产出就不要多次 edit_file。
3. 单轮最多 3 次工具调用；信息已足时立刻给出最终回复。
4. **最终回复**（不带 tool_calls 的那条）必须包含简明的"交付摘要"：产物路径 + 关键内容/功能，供验收使用。`;

// ─── 节点 ────────────────────────────────────────────────────────────────────

/** 入口路由：磁盘上有任务则直奔 scheduler，否则进 planner */
function entryRoute(state: S, config: any): "planner" | "scheduler" {
    const tid = getThreadId(config);
    return readTasksFile(tid).length > 0 ? "scheduler" : "planner";
}

/** 上下文压缩：messages 超阈值时压缩老消息为 summary，并 RemoveMessage */
async function compressNode(state: S): Promise<Partial<S>> {
    const msgs = state.messages;
    if (msgs.length <= MAX_MESSAGES) return {};
    const toCompress = msgs.slice(0, msgs.length - KEEP_RECENT);
    const transcript = toCompress
        .map((m) => {
            const c =
                typeof m.content === "string"
                    ? m.content
                    : JSON.stringify(m.content);
            return `[${m.getType()}] ${c.slice(0, 800)}`;
        })
        .join("\n")
        .slice(0, 12000);

    const resp = await lightModel.invoke([
        new SystemMessage(
            "把下面的 Agent 对话压缩成结构化要点：已完成什么 / 产物路径 / 关键决策 / 未决问题。尽量精简，不超过 800 字。",
        ),
        new HumanMessage(
            `# 之前摘要\n${state.summary || "(无)"}\n\n# 待压缩对话\n${transcript}`,
        ),
    ]);
    const newSummary =
        typeof resp.content === "string"
            ? resp.content
            : JSON.stringify(resp.content);

    const removes = toCompress
        .filter((m) => m.id)
        .map((m) => new RemoveMessage({ id: m.id! }));
    return { messages: removes, summary: newSummary };
}

/** Planner：只在第一次创建任务清单 */
async function plannerNode(state: S, config: any): Promise<Partial<S>> {
    const tid = getThreadId(config);
    if (readTasksFile(tid).length > 0) return {};
    const resp = await plannerModel.invoke([
        new SystemMessage(PLANNER_PROMPT),
        ...state.messages,
    ]);
    return { messages: [resp] };
}

function plannerRoute(state: S): "plan_tools" | typeof END {
    const last = state.messages[state.messages.length - 1];
    if (AIMessage.isInstance(last) && last.tool_calls?.length) return "plan_tools";
    return END; // 澄清问题或无产出 → 直接结束等待用户回复
}

/** Scheduler：从磁盘读 tasks，挑下一个 pending */
async function schedulerNode(state: S, config: any): Promise<Partial<S>> {
    const tid = getThreadId(config);
    const tasks = readTasksFile(tid);
    const next = pickNextTask(tasks);
    if (!next) {
        const total = tasks.length;
        const done = tasks.filter((t) => t.status === "completed").length;
        const cancelled = tasks.filter((t) => t.status === "cancelled").length;
        return {
            currentTaskId: null,
            messages: [
                new AIMessage(
                    `[已完成] 全部任务结束。完成 ${done}/${total}，跳过 ${cancelled}。`,
                ),
            ],
        };
    }
    if (next.status === "pending") {
        await markTaskStatus(tid, next.id, "in_progress");
    }
    return {
        currentTaskId: next.id,
        retries: 0,
        lastVerdict: null,
    };
}

function schedulerRoute(state: S): "executor" | typeof END {
    return state.currentTaskId ? "executor" : END;
}

/** Executor：聚焦单任务，受限工具 */
async function executorNode(state: S, config: any): Promise<Partial<S>> {
    const tid = getThreadId(config);
    const task = readTasksFile(tid).find((t) => t.id === state.currentTaskId);
    if (!task) return { currentTaskId: null };

    const retryHint = state.lastVerdict && !state.lastVerdict.pass
        ? state.lastVerdict.reason
        : "";
    const prompt = buildExecutorPrompt(task, state.summary, retryHint);

    // 只取尾部消息，避免重复喂大上下文
    const recent = state.messages.slice(-KEEP_RECENT);
    const resp = await executorModel.invoke([
        new SystemMessage(prompt),
        ...recent,
    ]);
    return { messages: [resp] };
}

function executorRoute(state: S): "exec_tools" | "validator" {
    const last = state.messages[state.messages.length - 1];
    if (AIMessage.isInstance(last) && last.tool_calls?.length) return "exec_tools";
    return "validator";
}

/** 取最近 N 条消息的简短摘要（type + content 截断） */
function recentHistory(messages: BaseMessage[], n: number, perMsgMax = 1200): string {
    const tail = messages.slice(-n);
    if (tail.length === 0) return "(无历史)";
    return tail
        .map((m) => {
            const c =
                typeof m.content === "string"
                    ? m.content
                    : JSON.stringify(m.content);
            return `- [${m.getType()}] ${c.slice(0, perMsgMax)}${c.length > perMsgMax ? "..." : ""}`;
        })
        .join("\n");
}

/**
 * Validator：只看对话历史，宽松判定。
 * 关注点仅限「方向性错误」：执行器是否理解错了任务、是否有明显 bug、
 * 是否答非所问（让去东跑去西）。不要追求完美。
 */
async function validatorNode(state: S, config: any): Promise<Partial<S>> {
    const tid = getThreadId(config);
    const task = readTasksFile(tid).find((t) => t.id === state.currentTaskId);
    if (!task) return { currentTaskId: null };

    const history = recentHistory(state.messages, 12);

    const verdictResp = await lightModel.invoke([
        new SystemMessage(
            `你是验收员。你只拿到两样东西：当前任务描述 + 最近的对话历史。

# 判定原则（**非常宽松**，默认 pass）
只有下面几类情况才判 false：
1. **方向性错误**：执行器理解错了任务（让去东结果跑去西），做的事跟任务目标明显不符。
2. **明显 bug / 错误**：代码/逻辑/事实层面有肉眼可见的错误（不是美观或风格问题）。
3. **完全没做**：执行器没采取任何相关动作，或答非所问。

# 不要当 false 的情况
- 细节不够完美、没有展示全部内容、缺少某个锦上添花的点 → 一律 pass。
- 模糊或精简的交付摘要 → 只要方向对，pass。
- 没贴文件内容给你看 → 不是失败理由，pass。
- 风格、排版、措辞问题 → pass。

# 输出
只回复一行 JSON：{"pass": true|false, "reason": "简明原因。fail 时必须具体指出哪里方向错了或哪里有 bug"}`,
        ),
        new HumanMessage(
            `# 当前任务
title: ${task.title}
description: ${task.description ?? ""}

# 最近对话历史
${history}`,
        ),
    ]);
    const text =
        typeof verdictResp.content === "string"
            ? verdictResp.content
            : JSON.stringify(verdictResp.content);
    // 默认 pass：解析失败也不因验收挡路
    let pass = true;
    let reason = "验收结果无法解析，默认放行";
    try {
        const m = text.match(/\{[\s\S]*\}/);
        if (m) {
            const json = JSON.parse(m[0]);
            pass = !!json.pass;
            reason = String(json.reason ?? "");
        }
    } catch {
        /* keep defaults */
    }

    if (pass) {
        await markTaskStatus(tid, task.id, "completed");
        return {
            currentTaskId: null,
            retries: 0,
            lastVerdict: { pass, reason },
            messages: [
                new AIMessage(`[验收通过] "${task.title}"：${reason}`),
            ],
        };
    }

    if (state.retries >= MAX_RETRIES) {
        await markTaskStatus(tid, task.id, "cancelled");
        return {
            currentTaskId: null,
            retries: 0,
            lastVerdict: { pass, reason },
            messages: [
                new AIMessage(
                    `[验收失败-放弃] "${task.title}" 已重试 ${state.retries} 次：${reason}`,
                ),
            ],
        };
    }

    return {
        retries: state.retries + 1,
        lastVerdict: { pass, reason },
        messages: [
            new HumanMessage(
                `[验收失败 第 ${state.retries + 1} 次] ${reason}\n请基于上述反馈修复，并重新给出包含产物路径与关键证据的交付摘要。`,
            ),
        ],
    };
}

function validatorRoute(state: S): "executor" | "scheduler" {
    return state.currentTaskId ? "executor" : "scheduler";
}

// ─── 构建图 ──────────────────────────────────────────────────────────────────
const workflow = new StateGraph(AgentState)
    .addNode("compress", compressNode)
    .addNode("planner", plannerNode)
    .addNode("plan_tools", new ToolNode(planTools))
    .addNode("scheduler", schedulerNode)
    .addNode("executor", executorNode)
    .addNode("exec_tools", new ToolNode(execTools))
    .addNode("validator", validatorNode)
    // 入口：根据是否已有任务分流
    .addConditionalEdges(START, entryRoute, {
        planner: "planner",
        scheduler: "scheduler",
    })
    // 规划阶段
    .addConditionalEdges("planner", plannerRoute, {
        plan_tools: "plan_tools",
        [END]: END,
    })
    .addEdge("plan_tools", "scheduler")
    // 调度
    .addConditionalEdges("scheduler", schedulerRoute, {
        executor: "compress", // 进入执行前先压缩
        [END]: END,
    })
    .addEdge("compress", "executor")
    // 执行 ↔ 工具
    .addConditionalEdges("executor", executorRoute, {
        exec_tools: "exec_tools",
        validator: "validator",
    })
    .addEdge("exec_tools", "executor")
    // 验收路由
    .addConditionalEdges("validator", validatorRoute, {
        executor: "executor",
        scheduler: "scheduler",
    });

export const agent = workflow.compile().withConfig({ recursionLimit: 200 });