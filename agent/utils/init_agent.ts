import { createMiddleware, initChatModel } from "langchain";
export * as tools from "../tools/index"

import { z } from "zod";

// if (!process.env.ANTHROPIC_API_KEY) {
//     throw new Error("ANTHROPIC_API_KEY is not set");
// }

// if (!process.env.OPENAI_MODEL) {
//     throw new Error("OPENAI_MODEL is not set");
// }

export const model = await initChatModel(
    process.env.OPENAI_MODEL,
    {
        outputVersion: "v1",
        modelProvider: "openai",
        baseUrl: process.env.OPENAI_BASE_URL,
        apiKey: process.env.OPENAI_API_KEY,
        thinking: { type: "enabled", budget_tokens: 10000 },
        reasoning_effort: "high",
    }
)

export const ModelSchema = z.object({
    api_url: z.string(),
    auth_id: z.string(),
    model_id: z.string(),
    modelProvider: z.string().optional().default("openai"),
    thinking: z.object({
        type: z.enum(["enabled", "disabled"]),
        budget_tokens: z.number().optional()
    }).nullable().optional().default(null),
    reasoning_effort: z.enum(["low", "medium", "high"]).nullable().optional().default(null),
});

export const ContextSchema = z.object({
    model: ModelSchema,
});

type RequiredModelShape = { model: typeof ModelSchema } & Record<string, z.ZodTypeAny>;

export function createContextAwareMiddleware<TShape extends RequiredModelShape>(
    contextSchema: z.ZodObject<TShape>
) {
    return createMiddleware({
        name: "ContextRouter",
        contextSchema, // 外部传入，shape 中必须包含 model: ModelSchema
        wrapModelCall: async (request, handler) => {
            const ctx = request.runtime.context as { model: z.infer<typeof ModelSchema> } & Record<string, any> | undefined;
            if (!ctx) return handler(request);
            const modelCtx = ctx.model;
            let availableTools = [...request.tools];

            let currentModel = model;
            try {
                const data: any = await fetch(modelCtx.api_url + "/auth-profiles/" + modelCtx.auth_id).then(res => res.json());
                const { apiKey, baseUrl } = data?.data?.credentials || {};
                if (apiKey) {
                    const config: Record<string, any> = {
                        outputVersion: "v1",
                        modelProvider: modelCtx.modelProvider || "openai",
                        apiKey: apiKey || process.env.OPENAI_API_KEY || "",
                        baseUrl: baseUrl || process.env.OPENAI_BASE_URL || "",
                    };
                    if (modelCtx.thinking != null) config.thinking = modelCtx.thinking;
                    if (modelCtx.reasoning_effort != null) config.reasoning_effort = modelCtx.reasoning_effort;
                    currentModel = await initChatModel(modelCtx.model_id || process.env.OPENAI_MODEL || "", config);
                }
            } catch (e) {
                console.error("Failed to fetch auth profile, using default model:", e);
            }

            return handler({ ...request, tools: availableTools, model: currentModel });
        }
    });
}
