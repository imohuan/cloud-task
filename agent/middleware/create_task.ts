import { createMiddleware, tool } from "langchain";
import { interrupt } from "@langchain/langgraph";
import { z } from "zod";
import type { BaseMessage } from "@langchain/core/messages";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { ModelSchema } from "../utils/init_agent.js";

// ─── 类型定义 ───────────────────────────────────────────────────────────────────

/**
 * 模型上下文类型
 */
type ModelCtx = z.infer<typeof ModelSchema>;

/**
 * MCP 工具定义接口
 */
interface MCPTool {
    name: string;
    description?: string;
    inputSchema: {
        type: "object";
        properties: Record<string, any>;
        required?: string[];
    };
}

/** 人工在环 (HITL) 响应结构 */
interface HITLResponse {
    /** 用户决策：批准、拒绝、编辑参数或直接回复 */
    decision: "approve" | "reject" | "edit" | "respond";
    /** 当决策为 reject 时，可选的拒绝理由 */
    reason?: string;
    /** 当决策为 edit 时，用户修改后的工具参数 */
    args?: Record<string, any>;
    /** 当决策为 respond 时，用户回复的消息内容 */
    message?: string;
}

/**
 * 工具注册条目，用于在 wrapToolCall 中查找上下文
 */
interface RegistryEntry {
    /** 原始 MCP 工具定义 */
    mcpTool: MCPTool;
    /** 当前会话中已上传至服务器的图片 URL 列表 */
    contextImages: string[];
    /** API 客户端实例，用于执行后续任务 */
    api: TaskApiClient;
    /** 包含 api_url, auth_id 等的模型上下文信息 */
    modelCtx: ModelCtx;
}

// ─── 接口调用客户端 ──────────────────────────────────────────────────────────────

/**
 * 任务 API 客户端
 */
class TaskApiClient {
    constructor(private readonly baseUrl: string) { }

    /**
     * 获取授权配置信息
     */
    async getAuthProfile(authId: string): Promise<{ platformId?: string }> {
        const res: any = await fetch(`${this.baseUrl}/auth-profiles/${authId}`).then((r) =>
            r.json()
        );
        return { platformId: res?.data?.platformId };
    }

    /**
     * 获取所有可用的 MCP 工具
     */
    async getMcpTools(): Promise<MCPTool[]> {
        const res: any = await fetch(`${this.baseUrl}/mcp/tools`).then((r) => r.json());
        return res?.data ?? [];
    }

    /**
     * 上传图片并返回服务器 URL
     */
    async uploadImage(raw: string): Promise<string | null> {
        if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
        if (!raw.startsWith("data:")) return null;

        const commaIdx = raw.indexOf(",");
        const meta = raw.slice(0, commaIdx);
        const b64 = raw.slice(commaIdx + 1);
        const mime = (meta.match(/data:([^;]+)/) ?? [])[1] ?? "image/jpeg";
        const ext = mime.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const blob = new Blob([bytes], { type: mime });
        const form = new FormData();
        form.append("file", blob, `upload.${ext}`);

        const res = await fetch(`${this.baseUrl}/upload`, { method: "POST", body: form });
        if (!res.ok) return null;
        const data: any = await res.json();
        return data?.url ? `${this.baseUrl.replace("/api", "")}${data.url}` : null;
    }

    /**
     * 发送任务执行请求
     */
    async executeTask(
        apiId: string,
        authProfileId: string,
        input: Record<string, any>
    ): Promise<any> {
        const res = await fetch(`${this.baseUrl}/tasks`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ apiId, authProfileId, input }),
        });
        return res.json();
    }
}

// ─── 注册表管理 ─────────────────────────────────────────────────────────────────

/** 动态生成的工具名前缀，用于在 UI 中区分常规工具和任务工具 */
const TASK_PREFIX = "CC_TASK_";
/** MCP 工具定义中可能包含图片的属性键名集合 */
const IMAGE_KEYS = ["image", "images"] as const;

// 存储每个线程的工具上下文映射：prefixedToolName -> RegistryEntry
const threadRegistry = new Map<string, Map<string, RegistryEntry>>();

// ─── 中间件实现 ───────────────────────────────────────────────────────────────

/**
 * 创建任务中间件
 */
export function createTaskMiddleware() {
    return createMiddleware({
        name: "TaskMiddleware",

        /**
         * 模型调用前的拦截：注入动态工具和上下文图片
         */
        wrapModelCall: async (request: any, handler: any) => {
            const ctx = request.runtime?.context as { model: ModelCtx } | undefined;
            if (!ctx?.model) return handler(request);

            const modelCtx = ctx.model;
            const api = new TaskApiClient(modelCtx.api_url);
            const threadId = getThreadId(request);

            try {
                // 1. 获取当前授权对应的平台 ID
                const { platformId } = await api.getAuthProfile(modelCtx.auth_id);
                if (!platformId) return handler(request);

                // 2. 加载并过滤该平台的 MCP 工具
                const allTools = await api.getMcpTools();
                const platformTools = allTools.filter(
                    (t) => t.name.split("_")[0] === platformId
                );
                if (platformTools.length === 0) return handler(request);

                // 3. 提取历史消息中的图片并上传到服务器获取稳定 URL
                const rawImages = extractContextImages(request.messages ?? []);
                const contextImages = (
                    await Promise.all(rawImages.map((raw) => api.uploadImage(raw)))
                ).filter((url): url is string => url !== null);

                // 4. 将工具及其执行上下文存入线程注册表，供 wrapToolCall 使用
                const registry = new Map<string, RegistryEntry>();
                for (const mcpTool of platformTools) {
                    registry.set(TASK_PREFIX + mcpTool.name, {
                        mcpTool,
                        contextImages,
                        api,
                        modelCtx,
                    });
                }
                threadRegistry.set(threadId, registry);

                // 5. 将工具存根绑定到模型请求中
                const modifiedRequest: any = {
                    ...request,
                    tools: [...(request.tools ?? []), ...platformTools.map(buildModelStub)],
                };

                // 6. 如果有上下文图片，向系统提示词注入图片 URL 提示，引导模型使用
                if (contextImages.length > 0) {
                    modifiedRequest.systemMessage = request.systemMessage?.concat
                        ? request.systemMessage.concat(buildImageHint(contextImages))
                        : new SystemMessage(buildImageHint(contextImages));
                }

                return handler(modifiedRequest);
            } catch (e) {
                console.error("[TaskMiddleware] wrapModelCall error:", e);
                return handler(request);
            }
        },

        /**
         * 工具调用时的拦截：执行真正的审批逻辑和后端任务发送
         */
        wrapToolCall: async (request: any, handler: any) => {
            const entry = threadRegistry
                .get(getThreadId(request))
                ?.get(request.toolCall?.name);
            if (!entry) return handler(request);

            // 换入真实的执行工具（包含 interrupt 审批逻辑）
            return handler({ ...request, tool: buildExecTool(entry) });
        },
    });
}

// ─── 工具构建器 ────────────────────────────────────────────────────────────

/**
 * 轻量级工具存根：仅用于模型绑定，不含实际执行逻辑
 */
function buildModelStub(mcpTool: MCPTool) {
    return tool(async () => "(pending approval)", {
        name: TASK_PREFIX + mcpTool.name,
        description: mcpTool.description ?? mcpTool.name,
        schema: z.object(buildSchemaShape(mcpTool)),
    });
}

/**
 * 真实的执行工具：处理参数注入、审批中断、以及后端任务触发
 */
function buildExecTool({ mcpTool, contextImages, api, modelCtx }: RegistryEntry) {
    const properties = mcpTool.inputSchema?.properties ?? {};
    const apiId = mcpTool.name.replace(/_/g, ".");

    return tool(
        async (args: Record<string, any>) => {
            // 自动注入上下文图片：始终优先使用当前会话中识别到的图片 URL
            const finalArgs: Record<string, any> = { ...args };
            for (const key of IMAGE_KEYS) {
                if (key in properties && contextImages.length > 0) {
                    finalArgs[key] = contextImages;
                }
            }

            // 人工在环 (HITL) 中断：此处会抛出异常暂停图执行，等待前端响应
            const response = interrupt({
                actionRequests: [
                    { action: mcpTool.name, description: mcpTool.description, args: finalArgs },
                ],
                reviewConfigs: [{ allowedDecisions: ["approve", "reject", "edit"] }],
            }) as HITLResponse | HITLResponse[];

            const decision = Array.isArray(response) ? response[0]! : response;

            // 处理用户决策
            if (decision.decision === "reject") {
                return `操作已被用户拒绝${decision.reason ? "：" + decision.reason : ""}`;
            }

            const execArgs =
                decision.decision === "edit" ? (decision.args ?? finalArgs) : finalArgs;

            // 用户批准或编辑后，调用后端 API 发起真实任务
            const data = await api.executeTask(apiId, modelCtx.auth_id, execArgs);
            return JSON.stringify(data);
        },
        {
            name: TASK_PREFIX + mcpTool.name,
            description: mcpTool.description ?? mcpTool.name,
            schema: z.object(buildSchemaShape(mcpTool)),
        }
    );
}

// ─── Schema 辅助函数 ───────────────────────────────────────────────────────────

/**
 * 根据 MCP 工具定义构建 Zod Schema
 */
function buildSchemaShape(mcpTool: MCPTool, excludeFields: string[] = ["authProfileId"]) {
    const properties = mcpTool.inputSchema?.properties ?? {};
    const required = new Set(mcpTool.inputSchema?.required ?? []);
    const shape: Record<string, z.ZodTypeAny> = {};

    for (const [key, prop] of Object.entries(properties)) {
        if (excludeFields.includes(key)) continue;
        let field = jsonSchemaToZod(prop);
        if (!required.has(key)) field = field.optional();
        shape[key] = field;
    }
    // 特殊处理图片字段，使其接受 URL 数组
    for (const key of IMAGE_KEYS) {
        if (key in shape) shape[key] = z.array(z.string()).optional();
    }
    return shape;
}

/**
 * JSON Schema 类型到 Zod 类型映射
 */
function jsonSchemaToZod(prop: any): z.ZodTypeAny {
    if (prop?.enum?.length) return z.enum(prop.enum as [string, ...string[]]);
    switch (prop?.type) {
        case "string": return z.string();
        case "number": return z.number();
        case "boolean": return z.boolean();
        case "array": return z.array(z.any());
        case "object": return z.record(z.string(), z.any());
        default: return z.any();
    }
}

// ─── 通用工具函数 ────────────────────────────────────────────────────────────────

/**
 * 获取当前线程 ID
 */
function getThreadId(request: any): string {
    return request.runtime?.configurable?.thread_id ?? "default";
}

/**
 * 从历史消息中提取用户最后发送的图片 URL (支持 base64)
 */
function extractContextImages(messages: BaseMessage[]): string[] {
    for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        if (HumanMessage.isInstance(msg) && Array.isArray(msg.content)) {
            const urls = (msg.content as any[])
                .filter((c) => c.type === "image_url" && c.image_url?.url)
                .map((c) => c.image_url.url as string);
            if (urls.length > 0) return urls;
        }
    }
    return [];
}

/**
 * 构建注入到系统提示词中的图片 URL 提示信息
 */
function buildImageHint(contextImages: string[]): string {
    return [
        "",
        "---",
        "用户已上传以下图片，调用图片处理工具时必须使用这些URL，禁止使用其他图片地址：",
        ...contextImages.map((url: string, i: number) => `图片${i + 1}: ${url}`),
        "---",
    ].join("\n");
}
