import { ChatOpenAI } from "@langchain/openai";
import type { BaseMessage } from "@langchain/core/messages";
import { createAgent } from "langchain"; // createReactAgent 已弃用，使用 langchain v1 的 createAgent
import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import { rootLogger } from "../../utils/logger";
import { skills } from "./skills";
import mcpConfig from "./mcp.json";

const logger = rootLogger.child("AI");

// ────────────────────────────────────────────────
// 配置（从环境变量读取）
// ────────────────────────────────────────────────
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
// 推理强度：OpenAI o1/o3/o4 及 DeepSeek V4 Pro 等支持（low / medium / high），留空则不传
const OPENAI_REASONING_EFFORT  = process.env.OPENAI_REASONING_EFFORT  || "";
// 显式开启思考模式：DeepSeek V4 Pro / Claude 等需要设为 true；DeepSeek R1 自动生效无需设置
const OPENAI_THINKING_ENABLED  = process.env.OPENAI_THINKING_ENABLED  === "true";
// 是否启用搜索（Tavily MCP）：默认开启，设为 false 则从工具列表中移除
const SEARCH_ENABLED           = process.env.SEARCH_ENABLED           !== "false";

const SYSTEM_PROMPT = `你是一个智能助手，需要时请主动调用可用工具来完成任务。`;

// ────────────────────────────────────────────────
// 单次请求的配置选项（覆盖环境变量默认值）
// ────────────────────────────────────────────────
export interface ChatOptions {
  model?:           string;            // 模型名称，不传则用 OPENAI_MODEL
  thinking?:        boolean;           // 是否开启思考模式
  reasoningEffort?: string;            // 推理强度："low" | "medium" | "high"
  search?:          boolean;           // 是否启用搜索工具（Tavily）
}

// ────────────────────────────────────────────────
// MCP 工具（慢，全局初始化一次后缓存）
// ────────────────────────────────────────────────
type McpData = {
  mcpClient:       MultiServerMCPClient;
  allMcpTools:     any[];
  searchToolNames: Set<string>;          // Tavily 工具名称集合，用于按需过滤
};
let _mcpData: McpData | null = null;
let _mcpInitPromise: Promise<McpData> | null = null;

function getMcp(): Promise<McpData> {
  if (_mcpData) return Promise.resolve(_mcpData);
  if (!_mcpInitPromise) {
    logger.info("正在初始化 MCP 工具...");
    _mcpInitPromise = (async () => {
      const mcpClient    = new MultiServerMCPClient(mcpConfig as any);
      const allMcpTools  = await mcpClient.getTools();

      // 识别 Tavily 搜索工具：优先按服务器名过滤，回退到按工具名匹配
      let searchToolNames = new Set<string>();
      try {
        const tavilyTools = await (mcpClient as any).getTools(["tavily"]);
        tavilyTools.forEach((t: any) => searchToolNames.add(t.name));
      } catch {
        allMcpTools
          .filter((t: any) => /tavily|web.?search|internet.?search/i.test(t.name))
          .forEach((t: any) => searchToolNames.add(t.name));
      }
      logger.info(`MCP 工具加载完成: ${allMcpTools.length} 个，搜索工具: [${[...searchToolNames].join(", ")}]`);

      _mcpData = { mcpClient, allMcpTools, searchToolNames };
      return _mcpData;
    })().catch((err) => { _mcpInitPromise = null; throw err; });
  }
  return _mcpInitPromise;
}

// ────────────────────────────────────────────────
// Agent（createAgent 很快，按配置 key 缓存）
// ────────────────────────────────────────────────
const _agentCache = new Map<string, ReturnType<typeof createAgent>>();

async function getAgent(options: ChatOptions = {}) {
  const { allMcpTools, searchToolNames } = await getMcp();

  const model       = options.model           ?? OPENAI_MODEL;
  const useThinking = options.thinking        ?? OPENAI_THINKING_ENABLED;
  const useEffort   = options.reasoningEffort ?? OPENAI_REASONING_EFFORT;
  const useSearch   = options.search          ?? SEARCH_ENABLED;

  const cacheKey = JSON.stringify({ model, useThinking, useEffort, useSearch });
  if (_agentCache.has(cacheKey)) return _agentCache.get(cacheKey)!;

  logger.info(`构建 Agent: model=${model} thinking=${useThinking} effort=${useEffort || "—"} search=${useSearch}`);

  const modelConfig: ConstructorParameters<typeof ChatOpenAI>[0] = {
    model,
    apiKey: OPENAI_API_KEY,
    configuration: { baseURL: OPENAI_BASE_URL },
  };
  if (useThinking || useEffort) {
    const modelKwargs: Record<string, unknown> = {};
    if (useThinking) modelKwargs["thinking"]         = { type: "enabled" };
    if (useEffort)   modelKwargs["reasoning_effort"] = useEffort;
    (modelConfig as any).modelKwargs = modelKwargs;
  }

  const mcpTools = useSearch
    ? allMcpTools
    : allMcpTools.filter(t => !searchToolNames.has(t.name));
  const allTools = [...skills, ...mcpTools];
  allTools.forEach(t => logger.debug(`工具: [${t.name}] ${t.description.slice(0, 100)}`))

  // createAgent 是 langchain v1 推荐的 Agent 构建方式
  // 底层仍由 LangGraph 驱动，支持工具调用循环直到模型不再调用工具为止
  const agent = createAgent({
    model: new ChatOpenAI(modelConfig),
    tools: allTools,
    systemPrompt: SYSTEM_PROMPT,
  });

  _agentCache.set(cacheKey, agent);
  logger.info(`Agent 缓存完成，当前缓存数: ${_agentCache.size}`);
  return agent;
}

// ────────────────────────────────────────────────
// 对外接口
// ────────────────────────────────────────────────
export async function chat(input: string, options?: ChatOptions): Promise<string> {
  const agent = await getAgent(options);
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
export async function* chatStream(input: string, options?: ChatOptions): AsyncGenerator<string> {
  const agent = await getAgent(options);
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
  | { type: "token"; content: string }
  | { type: "thinking"; content: string }
  | { type: "tool_start"; id: string; name: string; args: Record<string, unknown> }
  | { type: "tool_end"; id: string; name: string; result: string }
  | { type: "done" }
  | { type: "error"; message: string };

export async function* chatStreamEvents(
  input: string,
  images?: string[], // base64 data URLs, e.g. "data:image/png;base64,..."
  options?: ChatOptions,
): AsyncGenerator<ChatEvent> {
  const agent = await getAgent(options);
  try {
    const userContent = images?.length
      ? [
        { type: "text", text: input },
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
        // ① LangChain 标准归一化格式：contentBlocks[].type === "reasoning"（o1/o3/Claude 等）
        const contentBlocks: any[] = token?.contentBlocks ?? [];
        for (const block of contentBlocks) {
          if (block?.type === "reasoning" && typeof block.reasoning === "string" && block.reasoning) {
            yield { type: "thinking", content: block.reasoning };
          } else if (block?.type === "text" && typeof block.text === "string" && block.text) {
            yield { type: "token", content: block.text };
          }
        }
        if (contentBlocks.length > 0) continue; // 已通过 contentBlocks 处理，跳过下方兼容逻辑
        // ② 兼容格式：additional_kwargs.reasoning_content（DeepSeek R1、Qwen3 via OpenAI 兼容 API）
        const reasoningContent =
          token?.additional_kwargs?.reasoning_content ??
          token?.kwargs?.additional_kwargs?.reasoning_content;
        if (typeof reasoningContent === "string" && reasoningContent) {
          yield { type: "thinking", content: reasoningContent };
        }
        // ③ 普通文本 token
        if (typeof token?.content === "string" && token.content) {
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
              const id = tc.id ?? "";
              const name = tc.name ?? tc.function?.name ?? "";
              let args: Record<string, unknown> = tc.args ?? {};
              if (!tc.args && typeof tc.function?.arguments === "string") {
                try { args = JSON.parse(tc.function.arguments); } catch { /* ignore */ }
              }
              if (name) yield { type: "tool_start", id, name, args };
            }
            // ─ tool_end：ToolMessage 包含 tool_call_id ─
            const tcId = msg.tool_call_id ?? msg.kwargs?.tool_call_id;
            if (tcId) {
              const name = msg.name ?? msg.kwargs?.name ?? "";
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
// 模块加载时预热 MCP 工具（慢），Agent 按需懒创建
getMcp().catch((err) => logger.error("MCP 预热失败", err));


export const agent = getAgent(); // 预热 Agent，实际调用时会再次检查缓存

if (import.meta.main) {
  // const answer = await chat("帮我写一个 SQL，查询 users 表中最近 7 天注册的用户");
  // const answer = await chat("你有什么技能，工具");

  // process.stdout.write("\nAI: ");
  // for await (const chunk of chatStream("帮我算 `((25+15)*2)/5`")) {
  //   process.stdout.write(chunk);
  // }
  // console.log();
}
