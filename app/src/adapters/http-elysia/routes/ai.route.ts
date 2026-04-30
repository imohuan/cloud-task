import { Elysia, t } from "elysia";
import { chatStreamEvents } from "@adapters/ai";

export const aiRoutes = new Elysia({ prefix: "/api/ai" })
  .post(
    "/create",
    async ({ body }) => {
      const { input, images } = body;
      const encoder = new TextEncoder();

      const readable = new ReadableStream({
        async start(controller) {
          try {
            for await (const event of chatStreamEvents(input, images ?? [])) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
              if (event.type === "done" || event.type === "error") break;
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "error", message: msg })}\n\n`),
            );
          } finally {
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
        input:  t.String({ minLength: 1 }),
        images: t.Optional(t.Array(t.String())),
      }),
    },
  );
