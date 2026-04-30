import { ChatOpenAI } from "@langchain/openai";
import type { BaseMessage } from "@langchain/core/messages";
import { createAgent } from "langchain"; // createReactAgent 已弃用，使用 langchain v1 的 createAgent
import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import { skills } from "./skills";
import mcpConfig from "./mcp.json";

// ────────────────────────────────────────────────
// 配置（从环境变量读取）
// ────────────────────────────────────────────────
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
const OPENAI_API_KEY  = process.env.OPENAI_API_KEY  || "";
const OPENAI_MODEL    = process.env.OPENAI_MODEL    || "gpt-4o-mini";

const SYSTEM_PROMPT = `你是一个智能助手，需要时请主动调用可用工具来完成任务。`;

// ────────────────────────────────────────────────
// 构建 Agent（含 MCP + skills）
// ────────────────────────────────────────────────
async function buildAgent() {
  // 连接 mcp.json 中配置的所有 MCP 服务，获取其暴露的工具列表
  const mcpClient = new MultiServerMCPClient(mcpConfig as any);
  const mcpTools  = await mcpClient.getTools();

  // 合并内置 skills 与 MCP 远程工具
  const allTools = [...skills, ...mcpTools];

  console.log(`已加载工具: skills(${skills.length}) + mcp(${mcpTools.length}) = ${allTools.length} 个`);
  allTools.forEach(t => console.log(`  · [${t.name}] ${t.description}`));

  // createAgent 是 langchain v1 推荐的 Agent 构建方式
  // 底层仍由 LangGraph 驱动，支持工具调用循环直到模型不再调用工具为止
  const agent = createAgent({
    model: new ChatOpenAI({
      model: OPENAI_MODEL,
      apiKey: OPENAI_API_KEY,
      configuration: { baseURL: OPENAI_BASE_URL },
    }),
    tools: allTools,
    systemPrompt: SYSTEM_PROMPT, // prompt → systemPrompt
  });

  return { agent, mcpClient };
}

// ────────────────────────────────────────────────
// 对外接口
// ────────────────────────────────────────────────
export async function chat(input: string): Promise<string> {
  const { agent, mcpClient } = await buildAgent();
  try {
    const result = await agent.invoke({
      messages: [{ role: "user", content: input }],
    });
    // result 是 BuiltInState，最终回复在 messages 数组的最后一条
    const last: BaseMessage = result.messages[result.messages.length - 1];
    return typeof last.content === "string" ? last.content : JSON.stringify(last.content);
  } finally {
    // 关闭 MCP 连接，释放资源
    await mcpClient.close();
  }
}

// ────────────────────────────────────────────────
// 流式输出接口
// ────────────────────────────────────────────────
export async function* chatStream(input: string): AsyncGenerator<string> {
  const { agent, mcpClient } = await buildAgent();
  try {
    const stream = await agent.stream(
      { messages: [{ role: "user", content: input }] },
      { streamMode: "messages" },
    );
    for await (const [token] of stream) {
      const content = token.content;
      if (typeof content === "string" && content) {
        yield content;
      }
    }
  } finally {
    await mcpClient.close();
  }
}

// ────────────────────────────────────────────────
// 快速测试入口
// ────────────────────────────────────────────────
if (import.meta.main) {
  // const answer = await chat("帮我写一个 SQL，查询 users 表中最近 7 天注册的用户");
  // const answer = await chat("你有什么技能，工具");

  buildAgent()

  // process.stdout.write("\nAI: ");
  // for await (const chunk of chatStream("帮我算 `((25+15)*2)/5`")) {
  //   process.stdout.write(chunk);
  // }
  // console.log();
}
