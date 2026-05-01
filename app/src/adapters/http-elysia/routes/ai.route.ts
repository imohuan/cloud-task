import { Elysia, t } from "elysia";
import { Client } from "@langchain/langgraph-sdk";

const LANGGRAPH_API_URL = process.env.LANGGRAPH_API_URL || "http://localhost:2024";
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

// ── OpenAI v1 Mock ──────────────────────────────────────────────────────────

const MOCK_WORDS = [
  "Hello", "world", "this", "is", "a", "mock", "response", "from", "the", "AI",
  "assistant", "providing", "random", "data", "for", "testing", "purposes",
  "The", "quick", "brown", "fox", "jumps", "over", "the", "lazy", "dog",
  "OpenAI", "compatible", "API", "mock", "server", "returns", "random", "text",
  "streaming", "chunks", "simulated", "language", "model", "output",
];

function mockId() {
  return `chatcmpl-${Math.random().toString(36).slice(2, 11)}`;
}

function mockContent(wordCount = 20) {
  const words: string[] = [];
  for (let i = 0; i < wordCount; i++) {
    words.push(MOCK_WORDS[Math.floor(Math.random() * MOCK_WORDS.length)]);
  }
  return words.join(" ") + ".";
}

function mockUsage(tokens: string[]) {
  const prompt = Math.floor(Math.random() * 50) + 10;
  const completion = tokens.length;
  return { prompt_tokens: prompt, completion_tokens: completion, total_tokens: prompt + completion };
}

export const openaiMockRoutes = new Elysia({ prefix: "/v1" })
  .post("/chat/completions", async ({ body }) => {
    const req = (body as any) ?? {};
    const model: string = req.model ?? "gpt-4o";
    const stream: boolean = req.stream ?? false;
    const id = mockId();
    const created = Math.floor(Date.now() / 1000);
    const content = mockContent(Math.floor(Math.random() * 20) + 10);
    const tokens = content.split(" ");

    if (stream) {
      const enc = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          const send = (obj: unknown) =>
            controller.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`));

          send({
            id, object: "chat.completion.chunk", created, model,
            choices: [{ index: 0, delta: { role: "assistant", content: "" }, finish_reason: null }],
          });

          for (const token of tokens) {
            await new Promise(r => setTimeout(r, 30));
            send({
              id, object: "chat.completion.chunk", created, model,
              choices: [{ index: 0, delta: { content: token + " " }, finish_reason: null }],
            });
          }

          send({
            id, object: "chat.completion.chunk", created, model,
            choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
          });
          controller.enqueue(enc.encode("data: [DONE]\n\n"));
          controller.close();
        },
      });
      return new Response(readable, { headers: SSE_HEADERS });
    }

    return {
      id,
      object: "chat.completion",
      created,
      model,
      choices: [{
        index: 0,
        message: { role: "assistant", content },
        finish_reason: "stop",
      }],
      usage: mockUsage(tokens),
    };
  }, {
    body: t.Optional(t.Object({
      model: t.Optional(t.String()),
      messages: t.Optional(t.Array(t.Any())),
      stream: t.Optional(t.Boolean()),
      temperature: t.Optional(t.Number()),
      max_tokens: t.Optional(t.Number()),
    }, { additionalProperties: true })),
    detail: { summary: "OpenAI v1 chat completions mock (random data)", tags: ["openai-mock"] },
  })

  .get("/models", () => ({
    object: "list",
    data: [
      { id: "gpt-4o", object: "model", created: 1715367049, owned_by: "mock" },
      { id: "gpt-4-turbo", object: "model", created: 1712361441, owned_by: "mock" },
      { id: "gpt-3.5-turbo", object: "model", created: 1677610602, owned_by: "mock" },
    ],
  }), {
    detail: { summary: "OpenAI v1 models list mock", tags: ["openai-mock"] },
  });

// ── LangGraph 代理路由 ────────────────────────────────────────────────────────

export const aiRoutes = new Elysia({ prefix: "/api/chat" })
  // 流式运行（SSE 需特殊处理）
  .post("/threads/:threadId/runs/stream", async ({ params, body }) => {
    const req = (body as any) ?? {};
    const iterable = client.runs.stream(params.threadId, req?.assistant_id || ASSISTANT_ID, {
      input: req.input,
      command: req.command,
      streamMode: req.stream_mode ?? ["values"],
      config: req.config,
      metadata: req.metadata,
      multitaskStrategy: req.multitask_strategy,
      onDisconnect: req.on_disconnect,
      streamResumable: req.stream_resumable,
    });
    return new Response(toSSEStream(iterable as any), { headers: SSE_HEADERS });
  })

  // 其余所有 /api/chat/* 请求透明代理到 LangGraph 后端
  .all("/*", async ({ request, body }) => {
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
  });
