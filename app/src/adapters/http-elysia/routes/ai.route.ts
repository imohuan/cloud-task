import { Elysia } from "elysia";
import { Client } from "@langchain/langgraph-sdk";
import { initChatModel } from "langchain"
import { HumanMessage, Message, SystemMessage } from "@langchain/core/messages"

const LANGGRAPH_API_URL = process.env.LANGGRAPH_API_URL || "http://127.0.0.1:2024";
const ASSISTANT_ID = process.env.ASSISTANT_ID || "base_agent";

const STREAM_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

const client = new Client({ apiUrl: LANGGRAPH_API_URL });

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
};

function toSSEStream(iterable: AsyncIterable<{ event: string; data: unknown }>, signal?: AbortSignal) {
  const enc = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      const heartbeat = setInterval(() => {
        try { controller.enqueue(enc.encode(`:ping\n\n`)); } catch {}
      }, 15_000);
      try {
        for await (const chunk of iterable) {
          if (signal?.aborted) {
            controller.enqueue(enc.encode(`event: error\ndata: ${JSON.stringify({ message: "Stream timeout" })}\n\n`));
            break;
          }
          controller.enqueue(
            enc.encode(`event: ${chunk.event}\ndata: ${JSON.stringify(chunk.data)}\n\n`)
          );
        }
      } catch (err) {
        controller.enqueue(
          enc.encode(`event: error\ndata: ${JSON.stringify({ message: String(err) })}\n\n`)
        );
      } finally {
        clearInterval(heartbeat);
        controller.close();
      }
    },
  });
}

// ── 标题自动生成 ─────────────────────────────────────────────────────────────

let titleModel: Awaited<ReturnType<typeof initChatModel>> | null = null;

async function getTitleModel() {
  if (!titleModel) {
    titleModel = await initChatModel(process.env.OPENAI_MODEL || "gpt-4o-mini", {
      modelProvider: "openai",
      baseUrl: process.env.OPENAI_BASE_URL,
      apiKey: process.env.OPENAI_API_KEY,
      maxTokens: 30,
    });
  }
  return titleModel;
}

async function generateTitleForThread(threadId: string) {
  try {
    const thread = await client.threads.get(threadId);
    if (thread.metadata?.title) return;

    const state = await client.threads.getState(threadId);
    const messages = (state.values as any)?.messages
    if (!messages?.length) return;

    const firstHuman = messages.find((m: Message) => m.type === "human");
    if (!firstHuman) return;

    const content =
      typeof firstHuman.content === "string"
        ? firstHuman.content
        : JSON.stringify(firstHuman.content);

    const model = await getTitleModel();
    const response = await model.invoke([
      new SystemMessage("根据用户的第一条消息，生成一个简短的对话标题（10个字以内）。直接返回标题，不加引号和标点。"),
      new HumanMessage(content),
    ]);

    const title = (response.content as string).trim();
    if (title) {
      await client.threads.update(threadId, { metadata: { title } });
      console.log(`[generateTitle] thread ${threadId} => "${title}"`);
    }
  } catch (err) {
    console.error("[generateTitle] error:", err);
  }
}

// ── LangGraph 代理路由 ────────────────────────────────────────────────────────

async function proxyToLangGraph({ request, body }: { request: Request; body: unknown }) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/chat/, "");
  const target = `${LANGGRAPH_API_URL}${path}${url.search}`;

  const reqHeaders = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) reqHeaders.set("content-type", contentType);

  let proxyBody: string | null = null;
  if (request.method !== "GET" && request.method !== "HEAD" && body != null) {
    proxyBody = JSON.stringify(body);
    reqHeaders.set("content-type", "application/json");
  }

  const upstream = await fetch(target, {
    method: request.method,
    headers: reqHeaders,
    body: proxyBody,
    signal: AbortSignal.timeout(STREAM_TIMEOUT_MS),
  });

  // 上游返回 SSE：逐块透传，确保实时推送不被缓冲
  if (upstream.headers.get("content-type")?.includes("text/event-stream")) {
    const reader = upstream.body!.getReader();
    const stream = new ReadableStream({
      async pull(controller) {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
        } else {
          controller.enqueue(value);
        }
      },
      cancel() {
        reader.cancel();
      },
    });
    return new Response(stream, { status: upstream.status, headers: SSE_HEADERS });
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: upstream.headers,
  });
}

export const aiRoutes = new Elysia({ prefix: "/api/chat" })
  // 流式运行（SSE 需特殊处理）
  .post("/threads/:threadId/runs/stream", async ({ params, body }) => {
    const req = (body as any) ?? {};
    const threadId = params.threadId;

    async function* withTitleGen() {
      yield* client.runs.stream(threadId, req?.assistant_id || ASSISTANT_ID, body!) as any;
      generateTitleForThread(threadId).catch(console.error);
    }

    const streamSignal = AbortSignal.timeout(STREAM_TIMEOUT_MS);
    return new Response(toSSEStream(withTitleGen(), streamSignal), { headers: SSE_HEADERS });
  })

  // 其余所有 /api/chat/* 请求透明代理到 LangGraph 后端
  .get("/*", proxyToLangGraph)
  .all("/*", proxyToLangGraph);
