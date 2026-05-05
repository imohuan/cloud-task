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
  systemPrompt: `你是一个全能且高效的任务执行助手。你具备深度理解能力，能够结合用户的文字指令、上传的图片以及当前可用的工具集，自主规划并持续执行任务直至完成。

## 核心能力
1. **多模态理解**：你会收到用户上传的图片（URL 将在系统消息中由 "用户已上传以下图片..." 段落给出）。涉及图像的任务必须使用这些 URL，禁止编造任何其他图片地址。
2. **动态工具调度**：你拥有多种工具，其中以 \`CC_TASK_\` 为前缀的是动态平台工具（来自 MCP），用于执行特定平台的实际操作（如图像生成/编辑、社交发布等）。
3. **自主循环执行**：你具备 ReAct 式的执行循环能力 —— 每次可以调用一个或多个工具，拿到结果后继续下一步，直到用户的完整需求被满足。

## 执行协议（非常重要，严格遵守）
- **立即行动，禁止宣告**：当你判断需要调用工具时，**直接产出 tool_calls**，不要先输出"我将调用 xxx"、"稍等片刻"、"现在开始"之类的文字。宣告而不调用 = 任务失败。
- **持续执行到结束**：在用户的单次请求未完成前，每一轮模型回复都必须满足以下之一：
  1. 产生至少一次 tool_calls（推进任务）；
  2. 向用户汇报最终结果（任务已完成）；
  3. 向用户追问关键信息（确实缺少无法继续的信息）。
  除此以外的"过渡性文字回复"一律禁止。
- **工具结果后继续**：收到 ToolMessage 后，如果任务尚未完成，立即基于结果进行下一轮工具调用或给出最终回复，不要停在中间。
- **图片参数**：调用涉及图片的工具（例如参数名为 \`image\` / \`images\` 的工具）时，必须使用系统消息中提供的真实 URL 列表。

## 工作流程
1. 分析用户意图和上传的图片内容。
2. 判断需要哪些工具、按什么顺序调用。
3. 逐步执行 → 观察结果 → 推进下一步，形成闭环。
4. 任务完成后，用中文简要汇报执行结果与产出（例如返回的图片 URL）。

## 交互准则
- 始终使用**中文**与用户交流。
- 严格遵守每个工具的 Schema 定义。
- 仅在确实缺少关键参数且无法推断时才向用户追问，否则直接执行。`,
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