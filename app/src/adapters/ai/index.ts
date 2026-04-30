import { ChatOpenAI } from "@langchain/openai";
import type { BaseMessage } from "@langchain/core/messages";
import { createAgent } from "langchain"; // createReactAgent 已弃用，使用 langchain v1 的 createAgent
import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import { rootLogger } from "@utils/logger";
import { skills } from "./skills";
import mcpConfig from "./mcp.json";

const logger = rootLogger.child("AI");

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
type AgentInstance = Awaited<ReturnType<typeof buildAgent>>;
let _instance: AgentInstance | null = null;
let _initPromise: Promise<AgentInstance> | null = null;

function getAgent(): Promise<AgentInstance> {
  if (_instance) return Promise.resolve(_instance);
  if (!_initPromise) {
    logger.info("正在初始化 Agent...");
    _initPromise = buildAgent()
      .then((inst) => { _instance = inst; logger.info("Agent 初始化完成"); return inst; })
      .catch((err) => { _initPromise = null; throw err; });
  }
  return _initPromise;
}

async function buildAgent() {
  // 连接 mcp.json 中配置的所有 MCP 服务，获取其暴露的工具列表
  const mcpClient = new MultiServerMCPClient(mcpConfig as any);
  const mcpTools  = await mcpClient.getTools();

  // 合并内置 skills 与 MCP 远程工具
  const allTools = [...skills, ...mcpTools];

  logger.info(`已加载工具: skills(${skills.length}) + mcp(${mcpTools.length}) = ${allTools.length} 个`);
  allTools.forEach(t => logger.debug(`工具: [${t.name}] ${t.description.slice(0, 100)}`));

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

  logger.info(`Agent 预热完成`)
  return { agent, mcpClient };
}

// ────────────────────────────────────────────────
// 对外接口
// ────────────────────────────────────────────────
export async function chat(input: string): Promise<string> {
  const { agent } = await getAgent();
  const result = await agent.invoke({
    messages: [{ role: "user", content: input }],
  });
  // result 是 BuiltInState，最终回复在 messages 数组的最后一条
  const last: BaseMessage = result.messages[result.messages.length - 1];
  return typeof last.content === "string" ? last.content : JSON.stringify(last.content);
}

// ────────────────────────────────────────────────
// 流式输出接口
// ────────────────────────────────────────────────
export async function* chatStream(input: string): AsyncGenerator<string> {
  const { agent } = await getAgent();
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
}

// ────────────────────────────────────────────────
// 结构化事件流（供 SSE 接口使用）
// ────────────────────────────────────────────────
export type ChatEvent =
  | { type: "token";      content: string }
  | { type: "thinking";   content: string }
  | { type: "tool_start"; id: string; name: string; args: Record<string, unknown> }
  | { type: "tool_end";   id: string; name: string; result: string }
  | { type: "done" }
  | { type: "error";      message: string };

export async function* chatStreamEvents(
  input: string,
  images?: string[], // base64 data URLs, e.g. "data:image/png;base64,..."
): AsyncGenerator<ChatEvent> {
  const { agent } = await getAgent();
  try {
    const userContent = images?.length
      ? [
          { type: "text",      text: input },
          ...images.map((url) => ({ type: "image_url", image_url: { url } })),
        ]
      : input;
    logger.info("[stream] 开始请求 agent.stream", { inputLen: String(input).length, hasImages: !!images?.length });
    const stream = await agent.stream(
      { messages: [{ role: "user", content: userContent }] },
      { streamMode: ["messages", "updates"] },
    );
    logger.info("[stream] stream 对象已创建，开始迭代");
    for await (const [mode, chunk] of stream as AsyncIterable<[string, any]>) {
      logger.debug(`[stream] mode=${mode}`, { data: JSON.stringify(chunk).slice(0, 300) });
      if (mode === "messages") {
        const [token] = chunk;
        // ToolMessage 有 tool_call_id，跳过；只保留 AI 文字 token
        const toolCallId = token?.tool_call_id ?? token?.kwargs?.tool_call_id;
        if (toolCallId != null) continue;
        // 思考/推理内容（DeepSeek R1、Qwen3 等模型通过 reasoning_content 输出）
        const reasoningContent =
          token?.additional_kwargs?.reasoning_content ??
          token?.kwargs?.additional_kwargs?.reasoning_content;
        if (typeof reasoningContent === "string" && reasoningContent) {
          yield { type: "thinking", content: reasoningContent };
        }
        // 内容块数组（Claude Extended Thinking 格式）
        if (Array.isArray(token?.content)) {
          for (const block of token.content as any[]) {
            if (block?.type === "thinking" && typeof block.thinking === "string" && block.thinking) {
              yield { type: "thinking", content: block.thinking };
            } else if (block?.type === "text" && typeof block.text === "string" && block.text) {
              yield { type: "token", content: block.text };
            }
          }
        } else if (typeof token?.content === "string" && token.content) {
          yield { type: "token", content: token.content };
        }
      } else if (mode === "updates") {
        // 遍历所有节点的更新，不依赖固定节点名称
        for (const nodeUpdate of Object.values(chunk as Record<string, any>)) {
          for (const msg of nodeUpdate?.messages ?? []) {
            // ─ tool_start：AIMessage 包含 tool_calls ─
            const rawCalls: any[] =
              msg.tool_calls ??
              msg.kwargs?.tool_calls ??
              msg.additional_kwargs?.tool_calls ??
              [];
            for (const tc of rawCalls) {
              const id   = tc.id ?? "";
              const name = tc.name ?? tc.function?.name ?? "";
              let   args: Record<string, unknown> = tc.args ?? {};
              if (!tc.args && typeof tc.function?.arguments === "string") {
                try { args = JSON.parse(tc.function.arguments); } catch { /* ignore */ }
              }
              if (name) yield { type: "tool_start", id, name, args };
            }
            // ─ tool_end：ToolMessage 包含 tool_call_id ─
            const tcId = msg.tool_call_id ?? msg.kwargs?.tool_call_id;
            if (tcId) {
              const name    = msg.name    ?? msg.kwargs?.name    ?? "";
              const content = msg.content ?? msg.kwargs?.content ?? "";
              if (name) yield { type: "tool_end", id: tcId, name, result: String(content) };
            }
          }
        }
      }
    }
    logger.info("[stream] 迭代完成，发送 done");
    yield { type: "done" };
  } catch (err) {
    logger.error("[stream] 发生错误，发送 error 事件", err);
    yield { type: "error", message: err instanceof Error ? err.message : String(err) };
  }
}

// ────────────────────────────────────────────────
// 快速测试入口
// ────────────────────────────────────────────────
// 模块加载时预热 Agent，避免首次请求冷启动
getAgent().catch((err) => logger.error("Agent 预热失败", err));

if (import.meta.main) {
  // const answer = await chat("帮我写一个 SQL，查询 users 表中最近 7 天注册的用户");
  // const answer = await chat("你有什么技能，工具");

  getAgent()

  // process.stdout.write("\nAI: ");
  // for await (const chunk of chatStream("帮我算 `((25+15)*2)/5`")) {
  //   process.stdout.write(chunk);
  // }
  // console.log();
}
