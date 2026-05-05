import { createMiddleware, tool } from "langchain";
import { interrupt } from "@langchain/langgraph";
import { z } from "zod";
import type { BaseMessage } from "@langchain/core/messages";
import { SystemMessage } from "@langchain/core/messages";
import { ModelSchema } from "../utils/init_agent.js";

type ModelCtx = z.infer<typeof ModelSchema>;

interface MCPTool {
    name: string;
    description?: string;
    inputSchema: {
        type: "object";
        properties: Record<string, any>;
        required?: string[];
    };
}

interface HITLResponse {
    decision: "approve" | "reject" | "edit" | "respond";
    reason?: string;
    args?: Record<string, any>;
    message?: string;
}

// Per-thread registry: threadId → toolName → { mcpTool, contextImages, modelCtx }
const threadRegistry = new Map<
    string,
    Map<string, { mcpTool: MCPTool; contextImages: string[]; modelCtx: ModelCtx }>
>();

export function createTaskMiddleware() {
    return createMiddleware({
        name: "TaskMiddleware",

        wrapModelCall: async (request: any, handler: any) => {
            const ctx = request.runtime?.context as { model: ModelCtx } | undefined;
            if (!ctx?.model) return handler(request);

            const modelCtx = ctx.model;
            const threadId = getThreadId(request);

            try {
                // 1. Fetch auth profile → platformId
                const authRes: any = await fetch(
                    `${modelCtx.api_url}/auth-profiles/${modelCtx.auth_id}`
                ).then((r) => r.json());
                const platformId: string | undefined = authRes?.data?.platformId;
                if (!platformId) return handler(request);

                // 2. Fetch MCP tools → filter by platform prefix
                const toolsRes: any = await fetch(`${modelCtx.api_url}/mcp/tools`).then((r) =>
                    r.json()
                );
                const allMcpTools: MCPTool[] = toolsRes?.data ?? [];
                const platformTools = allMcpTools.filter(
                    (t) => t.name.split("_")[0] === platformId
                );

                if (platformTools.length === 0) return handler(request);

                // 3. Extract context images and upload to server for stable URLs
                const rawImages = extractContextImages(request.messages ?? []);
                const contextImages = rawImages.length > 0
                    ? await uploadContextImages(rawImages, modelCtx.api_url)
                    : [];

                // 4. Persist registry for wrapToolCall
                const registry = new Map<
                    string,
                    { mcpTool: MCPTool; contextImages: string[]; modelCtx: ModelCtx }
                >();
                for (const mcpTool of platformTools) {
                    registry.set(TASK_PREFIX + mcpTool.name, { mcpTool, contextImages, modelCtx });
                }
                threadRegistry.set(threadId, registry);

                // 5. Build tool stubs for model binding (execution handled in wrapToolCall)
                const stubs = platformTools.map((t) => buildModelStub(t));

                let modifiedRequest: any = {
                    ...request,
                    tools: [...(request.tools ?? []), ...stubs],
                };

                // Inject image URLs into system message so the model uses them in tool calls
                if (contextImages.length > 0) {
                    const imageHint = [
                        "",
                        "---",
                        "用户已上传以下图片，调用图片处理工具时必须使用这些URL，禁止使用其他图片地址：",
                        ...contextImages.map((url: string, i: number) => `图片${i + 1}: ${url}`),
                        "---",
                    ].join("\n");

                    modifiedRequest = {
                        ...modifiedRequest,
                        systemMessage: request.systemMessage?.concat
                            ? request.systemMessage.concat(imageHint)
                            : new SystemMessage(imageHint),
                    };
                }

                return handler(modifiedRequest);
            } catch (e) {
                console.error("[TaskMiddleware] wrapModelCall error:", e);
                return handler(request);
            }
        },

        wrapToolCall: async (request: any, handler: any) => {
            const threadId = getThreadId(request);
            const registry = threadRegistry.get(threadId);
            const entry = registry?.get(request.toolCall?.name);

            if (!entry) return handler(request);

            const { mcpTool, contextImages, modelCtx } = entry;

            // Swap in the real execution tool (which contains the interrupt + POST logic)
            const execTool = buildExecTool(mcpTool, contextImages, modelCtx);
            return handler({ ...request, tool: execTool });
        },
    });
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getThreadId(request: any): string {
    return request.runtime?.config?.configurable?.thread_id ?? "default";
}

async function uploadContextImages(rawImages: string[], apiUrl: string): Promise<string[]> {
    const results: string[] = [];
    for (const raw of rawImages) {
        try {
            if (raw.startsWith("http://") || raw.startsWith("https://")) {
                results.push(raw);
            } else if (raw.startsWith("data:")) {
                const commaIdx = raw.indexOf(",");
                const meta = raw.slice(0, commaIdx);
                const b64 = raw.slice(commaIdx + 1);
                const mime = (meta.match(/data:([^;]+)/) ?? [])[1] ?? "image/jpeg";
                const ext = mime.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
                const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
                const blob = new Blob([bytes], { type: mime });
                const form = new FormData();
                form.append("file", blob, `upload.${ext}`);
                const res = await fetch(`${apiUrl}/upload`, { method: "POST", body: form });
                if (!res.ok) continue;
                const data: any = await res.json();
                if (data?.url) results.push(`${apiUrl}${data.url}`);
            }
        } catch (e) {
            console.error("[TaskMiddleware] image upload error:", e);
        }
    }
    return results;
}

function extractContextImages(messages: BaseMessage[]): string[] {
    for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        if (msg._getType() === "human" && Array.isArray(msg.content)) {
            const urls = (msg.content as any[])
                .filter((c) => c.type === "image_url" && c.image_url?.url)
                .map((c) => c.image_url.url as string);
            if (urls.length > 0) return urls;
        }
    }
    return [];
}

function jsonSchemaToZod(prop: any): z.ZodTypeAny {
    if (prop?.enum && Array.isArray(prop.enum) && prop.enum.length > 0) {
        return z.enum(prop.enum as [string, ...string[]]);
    }
    switch (prop?.type) {
        case "string":
            return z.string();
        case "number":
            return z.number();
        case "boolean":
            return z.boolean();
        case "array":
            return z.array(z.any());
        case "object":
            return z.record(z.string(), z.any());
        default:
            return z.any();
    }
}

const TASK_PREFIX = "CC_TASK_";
const IMAGE_KEYS = ["image", "images"] as const;

function buildSchemaShape(mcpTool: MCPTool, excludeFields: string[] = []) {
    const properties = mcpTool.inputSchema?.properties ?? {};
    const required = new Set(mcpTool.inputSchema?.required ?? []);
    const shape: Record<string, z.ZodTypeAny> = {};

    for (const [key, prop] of Object.entries(properties)) {
        if (excludeFields.includes(key)) continue;
        let zField = jsonSchemaToZod(prop);
        if (!required.has(key)) zField = zField.optional();
        shape[key] = zField;
    }

    // Override image fields to accept string arrays
    for (const key of IMAGE_KEYS) {
        if (key in shape) {
            shape[key] = z.array(z.string()).optional();
        }
    }

    return shape;
}

/** Lightweight stub — just for model tool-binding; execution is handled by wrapToolCall. */
function buildModelStub(mcpTool: MCPTool) {
    const shape = buildSchemaShape(mcpTool, ["authProfileId"]);
    return tool(async () => "(pending approval)", {
        name: TASK_PREFIX + mcpTool.name,
        description: mcpTool.description ?? mcpTool.name,
        schema: z.object(shape),
    });
}

/** Real tool with HITL interrupt then POST /api/tasks. */
function buildExecTool(mcpTool: MCPTool, contextImages: string[], modelCtx: ModelCtx) {
    const properties = mcpTool.inputSchema?.properties ?? {};
    const shape = buildSchemaShape(mcpTool, ["authProfileId"]);
    const apiId = mcpTool.name.replace(/_/g, ".");

    return tool(
        async (args: Record<string, any>) => {
            // Always override image fields with context images when available
            const finalArgs: Record<string, any> = { ...args };
            for (const key of IMAGE_KEYS) {
                if (key in properties && contextImages.length > 0) {
                    finalArgs[key] = contextImages;
                }
            }

            // HITL interrupt — do NOT wrap in try/catch
            const response = interrupt({
                actionRequests: [
                    {
                        action: mcpTool.name,
                        description: mcpTool.description,
                        args: finalArgs,
                    },
                ],
                reviewConfigs: [
                    {
                        allowedDecisions: ["approve", "reject", "edit"],
                    },
                ],
            }) as HITLResponse | HITLResponse[];

            const decision = Array.isArray(response) ? response[0]! : response;

            if (decision.decision === "reject") {
                return `操作已被用户拒绝${decision.reason ? "：" + decision.reason : ""}`;
            }

            const execArgs =
                decision.decision === "edit" ? (decision.args ?? finalArgs) : finalArgs;

            const res = await fetch(`${modelCtx.api_url}/tasks`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    apiId,
                    authProfileId: modelCtx.auth_id,
                    input: execArgs,
                }),
            });

            const data = await res.json();
            return JSON.stringify(data);
        },
        {
            name: TASK_PREFIX + mcpTool.name,
            description: mcpTool.description ?? mcpTool.name,
            schema: z.object(shape),
        }
    );
}
