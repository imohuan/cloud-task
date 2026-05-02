import { Elysia, t } from "elysia";

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
};

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
