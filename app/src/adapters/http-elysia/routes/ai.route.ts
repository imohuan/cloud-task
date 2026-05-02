import { Elysia } from "elysia";
import { Client } from "@langchain/langgraph-sdk";

const LANGGRAPH_API_URL = process.env.LANGGRAPH_API_URL || "http://127.0.0.1:2024";
const ASSISTANT_ID = process.env.ASSISTANT_ID || "tool_calling";

const client = new Client({ apiUrl: LANGGRAPH_API_URL });

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
};

function toSSEStream(iterable: AsyncIterable<{ event: string; data: unknown }>) {
  const enc = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of iterable) {
          controller.enqueue(
            enc.encode(`event: ${chunk.event}\ndata: ${JSON.stringify(chunk.data)}\n\n`)
          );
        }
      } catch (err) {
        controller.enqueue(
          enc.encode(`event: error\ndata: ${JSON.stringify({ message: String(err) })}\n\n`)
        );
      } finally {
        controller.close();
      }
    },
  });
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
    const iterable = client.runs.stream(params.threadId, req?.assistant_id || ASSISTANT_ID, body!);
    return new Response(toSSEStream(iterable as any), { headers: SSE_HEADERS });
  })

  // 其余所有 /api/chat/* 请求透明代理到 LangGraph 后端
  .get("/*", proxyToLangGraph)
  .all("/*", proxyToLangGraph);
