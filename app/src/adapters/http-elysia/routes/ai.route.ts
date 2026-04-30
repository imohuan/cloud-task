import { Elysia, t } from "elysia";
import { chatStreamEvents, type ChatOptions } from "@adapters/ai";

export const aiRoutes = new Elysia({ prefix: "/api/ai" })
  .post(
    "/create",
    async ({ body }) => {
      const { input, images, model, thinking, reasoningEffort, search } = body;
      const options: ChatOptions = { model, thinking, reasoningEffort, search };
      const encoder = new TextEncoder();

      const readable = new ReadableStream({
        async start(controller) {
          const heartbeat = setInterval(() => {
            try { controller.enqueue(encoder.encode(": keepalive\n\n")); } catch {}
          }, 5_000);
          try {
            for await (const event of chatStreamEvents(input, images ?? [], options)) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
              if (event.type === "done" || event.type === "error") break;
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "error", message: msg })}\n\n`),
            );
          } finally {
            clearInterval(heartbeat);
            controller.close();
          }
        },
      });

      return new Response(readable, {
        headers: {
          "Content-Type":  "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache",
          "Connection":    "keep-alive",
          "X-Accel-Buffering": "no",
        },
      });
    },
    {
      body: t.Object({
        input:           t.String({ minLength: 1 }),
        images:          t.Optional(t.Array(t.String())),
        model:           t.Optional(t.String()),
        thinking:        t.Optional(t.Boolean()),
        reasoningEffort: t.Optional(t.String()),
        search:          t.Optional(t.Boolean()),
      }),
    },
  );
