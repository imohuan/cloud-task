import { initChatModel } from "langchain";
import { StateGraph, END, START, MessagesAnnotation } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { AIMessage } from "@langchain/core/messages";
import { searchTool, createLoadMcpTool, createLoadSkillTool, createBaseTools } from "../tools/index"
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { existsSync, mkdirSync } from "fs";

const WORKSPACE_DIR = join(dirname(fileURLToPath(import.meta.url)), "../workspace");
if (!existsSync(WORKSPACE_DIR)) {
    mkdirSync(WORKSPACE_DIR);
}

// 1. 定义你的工具集
const tools = [
    createLoadSkillTool(join(WORKSPACE_DIR, "skills")),
    searchTool,
    ...(await createLoadMcpTool()),
    ...createBaseTools(join(WORKSPACE_DIR, "base")),
];

if (!process.env.OPENAI_MODEL) {
    throw new Error("OPENAI_MODEL is not set");
}

const model = await initChatModel(
    process.env.OPENAI_MODEL,
    {
        modelProvider: "openai",
        baseUrl: process.env.OPENAI_BASE_URL,
        apiKey: process.env.OPENAI_API_KEY,
        thinking: { type: "enabled", budget_tokens: 10000 },
        reasoning_effort: "high",
    }
)

const toolNode = new ToolNode(tools);

// 2. 绑定工具到模型
const modelWithTools = model.bindTools(tools);

// 3. 定义 Agent 决策节点
const callModel = async (state: typeof MessagesAnnotation.State) => {
    const response = await modelWithTools.invoke([
        {
            role: "system",
            content: `# Role
你是一个高效、严谨的任务执行专家。你的核心工作逻辑是：深度思考 -> 任务拆解 -> 连续执行 -> 实时反馈。

# Workflow

1. 分析与追问：在正式开始前，评估任务难度。如存在歧义或信息缺失，必须先向用户提问。

2. 规划路径：确认需求后，调用 create_tasks 工具批量创建完整的任务清单，每个任务状态初始为 pending。

3. 沉浸执行：按顺序逐一处理任务，每完成一个子任务后，立即调用 update_tasks 工具将该任务状态更新为 completed，然后继续执行下一个任务，期间不得无故中止。

4. 终止条件：调用 list_tasks 工具确认所有任务状态均为 completed 后，在最终回复中输出 [已完成] 字符串，标志本次任务全部结束。

# Constraints

- 非交互模式：任务创建后，进入闭环执行模式，不再输出中间询问，直到所有任务处理完毕。
- 颗粒度控制：任务项需具备可操作性，难度分配要合理。
- 强制性：必须通过 update_tasks 将所有任务标记为 completed，才能输出 [已完成]，否则继续执行。
- 工具优先：任务状态管理必须通过 create_tasks / update_tasks / list_tasks 工具完成，不得仅在文字中声明完成。

# Initial Action
请分析我接下来的指令，如果理解清晰，请直接调用 create_tasks 创建任务清单并开始执行；如有疑问，请立即提问。`,
        },
        ...state.messages,
    ]);
    // 这里可以加入你的逻辑：检查任务清单是否全部 [已完成]
    return { messages: [response] };
};

// 4. 定义跳转逻辑：只要有工具调用，就一直循环
const shouldContinue = (state: typeof MessagesAnnotation.State) => {
    const lastMessage = state.messages[state.messages.length - 1];
    if (lastMessage instanceof AIMessage && lastMessage.tool_calls?.length) {
        return "tools"; // 继续执行工具
    }

    // 如果没有工具调用，根据你的 Prompt 逻辑判断是否真正结束
    const content =
        typeof lastMessage.content === "string"
            ? lastMessage.content
            : lastMessage.content
                  .map((c) => (typeof c === "string" ? c : "text" in c ? c.text : ""))
                  .join("");
    if (content.includes("[已完成]")) {
        return END;
    }

    // 否则，任务尚未完成，强制回到 agent 继续思考（recursionLimit 兜底）
    return "agent";
};

// 5. 构建图
const workflow = new StateGraph(MessagesAnnotation)
    .addNode("agent", callModel)
    .addNode("tools", toolNode)
    .addEdge(START, "agent")
    .addConditionalEdges("agent", shouldContinue)
    .addEdge("tools", "agent"); // 执行完工具必须回到 Agent 节点

export const agent = workflow.compile().withConfig({ recursionLimit: 100 });