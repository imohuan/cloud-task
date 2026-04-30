import { ChatOpenAI } from "@langchain/openai";
import { StateGraph, MessagesAnnotation, END, START } from "@langchain/langgraph";
import { HumanMessage, BaseMessage } from "@langchain/core/messages";

// ────────────────────────────────────────────────
// 配置（从环境变量读取）
// ────────────────────────────────────────────────
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
const OPENAI_API_KEY  = process.env.OPENAI_API_KEY  || "";
const OPENAI_MODEL    = process.env.OPENAI_MODEL    || "gpt-4o-mini";

// ────────────────────────────────────────────────
// 模型
// ────────────────────────────────────────────────
function createModel() {
  return new ChatOpenAI({
    model: OPENAI_MODEL,
    apiKey: OPENAI_API_KEY,
    configuration: {
      baseURL: OPENAI_BASE_URL,
    },
  });
}

// ────────────────────────────────────────────────
// 图节点
// ────────────────────────────────────────────────
async function callModel(state: typeof MessagesAnnotation.State) {
  const model = createModel();
  const response = await model.invoke(state.messages);
  return { messages: [response] };
}

// ────────────────────────────────────────────────
// 构建图
// ────────────────────────────────────────────────
function buildGraph() {
  const graph = new StateGraph(MessagesAnnotation)
    .addNode("chat", callModel)
    .addEdge(START, "chat")
    .addEdge("chat", END);

  return graph.compile();
}

export const aiGraph = buildGraph();

// ────────────────────────────────────────────────
// 对外接口
// ────────────────────────────────────────────────
export async function chat(input: string): Promise<string> {
  const result = await aiGraph.invoke({
    messages: [new HumanMessage(input)],
  });

  const last: BaseMessage = result.messages[result.messages.length - 1];
  return typeof last.content === "string" ? last.content : JSON.stringify(last.content);
}

// ────────────────────────────────────────────────
// 快速测试入口（直接运行此文件时执行）
// ────────────────────────────────────────────────
if (import.meta.main) {
  const answer = await chat("你好，简单介绍一下你自己");
  console.log("AI:", answer);
}
