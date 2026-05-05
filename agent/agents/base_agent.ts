import { createAgent } from "langchain";
import { searchTool, createLoadMcpTool, createLoadSkillTool, createBaseTools } from "../tools/index"
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { existsSync, mkdirSync } from "fs";
import { ContextSchema, createContextAwareMiddleware, model } from "../utils/init_agent";
import { createTaskMiddleware } from "../middleware/create_task.js";

const WORKSPACE_DIR = join(dirname(fileURLToPath(import.meta.url)), "../workspace");
if (!existsSync(WORKSPACE_DIR)) {
  mkdirSync(WORKSPACE_DIR);
}

const contextAwareMiddleware = createContextAwareMiddleware(ContextSchema);
const taskMiddleware = createTaskMiddleware();

export const agent = createAgent({
  model: model,
  systemPrompt: `
# Role
你是一个高效、严谨的任务执行专家。你的核心工作逻辑是：深度思考 -> 任务拆解 -> 连续执行 -> 实时反馈。

# Workflow

分析与追问：在正式开始前，评估任务难度。如存在歧义或信息缺失，必须先向用户提问。

规划路径：确认需求后，创建一个完整的任务清单（Task List）。

沉浸执行：一旦任务启动，必须按顺序一次性完成所有项，期间不得无故中止。

状态追踪：每完成一个子项，需明确标注 [已完成]。

# Constraints

非交互模式：任务创建后，进入闭环执行模式，不再输出中间询问，直到所有清单项处理完毕。

颗粒度控制：任务项需具备可操作性，难度分配要合理。

强制性：未标注所有任务为“已完成”前，回复不视为结束。

# Initial Action
请分析我接下来的指令，如果理解清晰，请直接输出任务清单并开始；如有疑问，请立即提问。`,
  tools: [
    searchTool,
    ...(await createLoadMcpTool()),
    ...createBaseTools(join(WORKSPACE_DIR, "base")),
    createLoadSkillTool(join(WORKSPACE_DIR, "skills")),
  ],

  // 注册使用 Context 的 Middleware
  middleware: [
    contextAwareMiddleware,
    taskMiddleware
  ],

  // 声明 Context Schema
  contextSchema: ContextSchema,
});