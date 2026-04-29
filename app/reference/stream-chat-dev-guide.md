# 流式输出 + 图文混合预览 - 实现文档（后台驱动版）

## 概述

后台 Worker 完整驱动流式计算。前端创建任务后订阅 SSE，Worker 调用 OpenAI 流式接口、将 delta 转发给前端、流结束后保存完整输出和日志。

**变更范围**: 6 处后端 + 3 处前端，**完全不破坏现有 async/polling 任务逻辑**。

---

## 架构概览

```
前端                              后端 Worker                       OpenAI
 │                                    │                               │
 │  POST /api/tasks                   │                               │
 │  { apiId, authProfileId, input }   │                               │
 │ ──────────────────────────────────►│  DB: insert task (pending)    │
 │  { taskId }                        │                               │
 │◄───────────────────────────────────│                               │
 │                                    │                               │
 │  GET /api/tasks/:taskId/stream     │                               │
 │ ──────────────────────────────────►│  StreamBus.subscribe(taskId)  │
 │  (挂起，等待 SSE 事件)              │                               │
 │                                    │                               │
 │                               Worker 领取任务                      │
 │                               executionMode === 'stream'           │
 │                               → executeStreamHandler()             │
 │                               DB: status = 'running'               │
 │                                    │                               │
 │                                    │  POST /chat/completions       │
 │                                    │  stream: true ───────────────►│
 │                                    │                               │
 │◄── data:{type:'delta',text:'..'}───│◄── SSE delta chunks ──────────│
 │◄── data:{type:'delta',text:'..'}───│◄── SSE delta chunks ──────────│
 │                                    │                               │
 │                               stream 结束                          │
 │                               parseTextToContentSegments()         │
 │                               DB: status='completed', output={}    │
 │                               logger.info(完整文本)                 │
 │◄── data:{type:'done'} ─────────────│                               │
 │  taskStore.fetchTasks()            │                               │
```

---

## 一、后端改动

### 1.1 扩展类型定义

**文件**: `app/src/core/contracts/api.types.ts`

```typescript
// 添加 'stream' 到 ExecutionMode
export type ExecutionMode = 'sync' | 'async' | 'stream';

// 新增：流式 chunk 结构（Worker → StreamBus → SSE → 浏览器）
export interface StreamChunk {
  /** 事件类型 */
  type: 'delta' | 'done' | 'error';
  /** 增量文字内容（type=delta 时有值） */
  text?: string;
  /** 错误信息（type=error 时有值） */
  error?: { code: string; message: string };
}
```

---

### 1.2 `BaseApiHandler` 添加 `executeStream()`

**文件**: `app/src/core/domain/api/base-api.handler.ts`

```typescript
import type { StreamChunk } from '@core/contracts/api.types';

// 在 BaseApiHandler 类中添加（默认抛出错误，子类按需覆盖）：
async *executeStream(
  context: ApiCallContext,
  authContext: AuthContext
): AsyncGenerator<StreamChunk, void, unknown> {
  throw new Error('此 Handler 未实现 executeStream() 方法');
}
```

---

### 1.3 新增 `StreamBus` 内存通道

**文件**: `app/src/adapters/http-elysia/routes/stream-bus.ts` （新建）

Worker 和 SSE 路由通过这个单例通信。Worker 向 taskId 对应的通道 push 数据，SSE 路由订阅该通道并转发给浏览器。内置缓冲区解决订阅晚于首个 chunk 到达的竞态问题。

```typescript
type Listener = (data: string) => void;

class StreamBus {
  /** 每个 taskId 对应的活跃监听器集合 */
  private listeners = new Map<string, Set<Listener>>();
  /** 订阅者到达前的缓冲区（防止 Worker 先于 SSE 连接启动） */
  private buffer = new Map<string, string[]>();
  /** 标记已关闭的 taskId，防止重复 close */
  private closed = new Set<string>();

  /** Worker 调用：推送一条 SSE 事件字符串到 taskId 通道 */
  push(taskId: string, sseData: string): void {
    const set = this.listeners.get(taskId);
    if (set && set.size > 0) {
      for (const fn of set) fn(sseData);
    } else {
      // 还没有订阅者，先缓冲
      if (!this.buffer.has(taskId)) this.buffer.set(taskId, []);
      this.buffer.get(taskId)!.push(sseData);
    }
  }

  /** SSE 路由调用：注册监听器，并立即 flush 已缓冲的数据 */
  subscribe(taskId: string, listener: Listener): void {
    if (!this.listeners.has(taskId)) this.listeners.set(taskId, new Set());
    this.listeners.get(taskId)!.add(listener);

    // flush buffer
    const buffered = this.buffer.get(taskId);
    if (buffered) {
      for (const item of buffered) listener(item);
      this.buffer.delete(taskId);
    }
  }

  /** SSE 路由调用：连接断开时取消订阅 */
  unsubscribe(taskId: string, listener: Listener): void {
    this.listeners.get(taskId)?.delete(listener);
  }

  /** Worker 调用：流结束，清理资源 */
  close(taskId: string): void {
    if (this.closed.has(taskId)) return;
    this.closed.add(taskId);
    this.listeners.delete(taskId);
    this.buffer.delete(taskId);
    // 30s 后清除 closed 标记，允许同一 taskId 重试
    setTimeout(() => this.closed.delete(taskId), 30_000);
  }
}

export const streamBus = new StreamBus();
```

---

### 1.4 `task.route.ts` 新增流式处理器和 SSE 端点

**文件**: `app/src/adapters/http-elysia/routes/task.route.ts`

#### 修改点 1：新增 `executeStreamHandler`

在 `executeTaskHandler` 和 `pollTaskHandler` 之后，`taskHandler` 之前插入：

```typescript
import { streamBus } from './stream-bus';

/** 执行流式任务 */
const executeStreamHandler = async (payload: TaskPayload, helpers: any) => {
  const { taskRunId, apiId, authProfileId, input } = payload;
  const repo = getTaskRunRepository();
  const startTime = Date.now();

  await repo.updateStatus(taskRunId, 'running', { startedAt: new Date(), progress: 10 });
  logger.info(`🌊 [StreamHandler] 开始流式任务: ${taskRunId}, apiId=${apiId}`);

  const handler = registry.getApiHandler(apiId);
  if (!handler) throw new Error(`API 不存在: ${apiId}`);

  const authContext = await buildAuthContext(apiId, authProfileId);
  const context = { authProfileId, input: input || {}, requestId: `req-${Date.now()}`, taskRunId };

  let accumulatedText = '';

  try {
    for await (const chunk of handler.executeStream(context, authContext)) {
      if (chunk.type === 'delta' && chunk.text) {
        accumulatedText += chunk.text;
        // 转发给 SSE 订阅者
        streamBus.push(taskRunId, `data: ${JSON.stringify(chunk)}\n\n`);
      } else if (chunk.type === 'error') {
        streamBus.push(taskRunId, `data: ${JSON.stringify(chunk)}\n\n`);
        throw new Error(chunk.error?.message ?? '流式生成异常');
      }
    }

    // 流结束：解析完整内容，保存到 DB
    const content = parseTextToContentSegments(accumulatedText);
    const output = {
      content,
      raw: { text: accumulatedText },
    };
    const duration = Date.now() - startTime;

    await repo.updateStatus(taskRunId, 'completed', {
      output,
      progress: 100,
      completedAt: new Date(),
    });

    logger.info(`[${taskRunId}] ✅ 流式任务完成, 耗时: ${duration}ms, 字符数: ${accumulatedText.length}`);
    helpers.logger.info(`✅ 流式任务完成: ${taskRunId}, 耗时: ${duration}ms`);

    // 通知前端流结束
    streamBus.push(taskRunId, `data: ${JSON.stringify({ type: 'done' })}\n\n`);

  } catch (error: any) {
    const duration = Date.now() - startTime;
    logger.error(`[${taskRunId}] ❌ 流式任务异常, 耗时: ${duration}ms`, error);
    helpers.logger.error(`❌ 流式任务异常: ${error.message}`);
    await repo.updateStatus(taskRunId, 'failed', {
      error: { code: 'STREAM_EXECUTION_FAILED', message: error.message, details: error.stack },
      completedAt: new Date(),
    });
    streamBus.push(taskRunId, `data: ${JSON.stringify({ type: 'error', error: { code: 'STREAM_EXECUTION_FAILED', message: error.message } })}\n\n`);
    throw error;
  } finally {
    streamBus.close(taskRunId);
  }
};
```

> `parseTextToContentSegments` 见 §1.5，在同一文件顶部定义为模块私有函数。

#### 修改点 2：`taskHandler` 增加 stream 分支

```typescript
const taskHandler: TaskHandler = async (payload: TaskPayload, helpers) => {
  const repo = getTaskRunRepository();
  const task = await repo.findById(payload.taskRunId);

  const metadata = registry.getApiMetadata(payload.apiId);

  // 新增：stream 模式走流式处理器
  if (metadata?.executionMode === 'stream') {
    return executeStreamHandler(payload, helpers);
  }

  if (task?.status === 'polling-run') {
    return pollTaskHandler(payload, helpers, task);
  }
  return executeTaskHandler(payload, helpers);
};
```

#### 修改点 3：在 `taskRoutes` 上追加 SSE 端点

```typescript
// 追加到 taskRoutes 的链式调用末尾：
  .get('/:taskId/stream', async ({ params, set }) => {
    const { taskId } = params;

    // 快速检查任务存在性
    const task = await getTaskRunRepository().findById(taskId);
    if (!task) {
      return { success: false, error: { code: 'TASK_NOT_FOUND', message: '任务不存在' } };
    }

    // ✅ 只有流式任务才允许 SSE 订阅
    const metadata = registry.getApiMetadata(task.apiId);
    if (metadata?.executionMode !== 'stream') {
      set.status = 400;
      return { success: false, error: { code: 'NOT_STREAM_TASK', message: '该任务不支持流式输出' } };
    }

    set.headers['Content-Type'] = 'text/event-stream';
    set.headers['Cache-Control'] = 'no-cache';
    set.headers['Connection'] = 'keep-alive';
    set.headers['X-Accel-Buffering'] = 'no'; // 禁用 nginx 缓冲

    const encoder = new TextEncoder();

    // ... 后续 SSE 逻辑

    const stream = new ReadableStream({
      start(controller) {
        const send = (data: string) => {
          try { controller.enqueue(encoder.encode(data)); } catch {}
        };

        // 如果任务已完成，立即发 done 并关闭
        if (task.status === 'completed' || task.status === 'failed') {
          if (task.status === 'completed') {
            send(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
          } else {
            send(`data: ${JSON.stringify({ type: 'error', error: task.error })}\n\n`);
          }
          controller.close();
          return;
        }

        // 订阅 StreamBus，等待 Worker 推送
        streamBus.subscribe(taskId, send);

        // 心跳，防止代理超时断连（每 15s）
        const heartbeat = setInterval(() => {
          try { controller.enqueue(encoder.encode(': ping\n\n')); } catch { clearInterval(heartbeat); }
        }, 15_000);

        // 连接关闭时清理
        (controller as any).oncancel = () => {
          clearInterval(heartbeat);
          streamBus.unsubscribe(taskId, send);
        };
      },
    });

    return new Response(stream, { headers: set.headers as HeadersInit });
  }, {
    params: t.Object({ taskId: t.String() }),
    detail: { summary: '订阅任务流式输出（SSE）', tags: ['tasks'] },
  })
```

#### 修改点 4：创建任务响应中携带 `streamUrl`（供前端自动订阅）

在 `POST /api/tasks` 创建任务的响应处理中，检测到 `executionMode === 'stream'` 时，在 `data` 中添加 `streamUrl` 字段：

```typescript
// 在 POST /api/tasks 的 handler 内，返回响应前：
const metadata = registry.getApiMetadata(apiId);
const responseData: any = { taskId };

// ✅ 流式任务额外返回 SSE 订阅地址，前端据此自动决定是否订阅
if (metadata?.executionMode === 'stream') {
  responseData.streamUrl = `/tasks/${taskId}/stream`;
}

return {
  success: true,
  data: responseData,
};
```

前端根据 `streamUrl` 是否存在即可知道是否需要建立 SSE 连接，无需再查询 API 元数据。

---

### 1.5 `parseTextToContentSegments` 工具函数

在 `task.route.ts` 文件顶部（导入之后）定义为模块私有函数，供 `executeStreamHandler` 调用：

```typescript
type ContentSegment =
  | { type: 'text'; text: string }
  | { type: 'image'; url: string };

/**
 * 将模型返回的混合文本解析为 text/image 段数组。
 * 支持：
 *   - 裸图片 URL: https://example.com/img.png
 *   - Markdown 图片: ![alt](https://example.com/img.png)
 * 多个连续文本块会自动合并。
 */
function parseTextToContentSegments(text: string): ContentSegment[] {
  const IMAGE_REGEX =
    /!\[.*?\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/\S+\.(?:png|jpg|jpeg|webp|gif)(?:[?#]\S*)?)/gi;

  const segments: ContentSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = IMAGE_REGEX.exec(text)) !== null) {
    const url = match[1] ?? match[0];
    if (match.index > lastIndex) {
      const textPart = text.slice(lastIndex, match.index).trim();
      if (textPart) segments.push({ type: 'text', text: textPart });
    }
    segments.push({ type: 'image', url });
    lastIndex = match.index + match[0].length;
  }

  const remaining = text.slice(lastIndex).trim();
  if (remaining) segments.push({ type: 'text', text: remaining });
  if (segments.length === 0) segments.push({ type: 'text', text });

  return segments;
}
```

---

### 1.6 `openai.api.ts` 实现 `executeStream()`

**文件**: `app/src/platforms/yunwu/categories/chat/openai.api.ts`

#### 修改点 1：`executionMode` 改为 `'stream'`

```typescript
executionMode: 'stream',
```

#### 修改点 2：添加 `executeStream()` 实现

在 `execute()` 方法之后新增（注意 `import type { StreamChunk }` 加在文件顶部导入区）：

```typescript
async *executeStream(
  context: ApiCallContext,
  authContext: AuthContext
): AsyncGenerator<StreamChunk, void, unknown> {
  const input = context.input as OpenAIChatGenerateImageInput;
  const { logger } = executor;
  const { taskRunId } = context as any;

  logger.info(`[${taskRunId}] 开始 OpenAI Chat 流式生成`, { model: input.model });

  // executor 提供认证信息和 baseUrl
  const baseUrl = (executor as any).getBaseUrl(authContext);
  const authHeaders = (executor as any).getAuthHeaders(authContext);

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { ...authHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: input.model ?? 'gpt-5.4-nano',
      stream: true,
      messages: [{ role: 'user', content: input.prompt }],
    }),
  });

  if (!response.ok || !response.body) {
    yield { type: 'error', error: { code: 'HTTP_ERROR', message: `HTTP ${response.status}` } };
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const raw = line.slice(6).trim();
      if (raw === '[DONE]') continue;

      try {
        const parsed = JSON.parse(raw);
        const delta = parsed.choices?.[0]?.delta?.content;
        if (typeof delta === 'string' && delta.length > 0) {
          yield { type: 'delta', text: delta };
        }
      } catch {
        // 忽略无法解析的行
      }
    }
  }
  // Worker 负责 accumulatedText 和 done/error 的最终处理，这里只负责产生 delta
}
```

> **注意**：`executeStream()` 只 yield delta，不 yield done。`done` 由 `executeStreamHandler`（Worker 层）在迭代结束后统一处理，这样 Worker 掌握完整文本后才写库、记日志、发 done 事件。

---

## 二、前端改动

### 2.1 `api/index.ts` 添加 `taskApi.subscribeStream()`

**文件**: `web/src/api/index.ts`

```typescript
import { API_BASE } from '@/utils/request';

// 追加到 taskApi 对象中：
/**
 * 订阅任务流式输出（SSE）
 * @param taskId 任务 ID
 * @param streamUrl 后端返回的 SSE 订阅地址（如 `/api/tasks/{taskId}/stream`）
 */
subscribeStream(
  taskId: string,
  streamUrl: string,  // ✅ 从 createTask 响应中获取
  callbacks: {
    onDelta: (text: string) => void;
    onDone: () => void;
    onError: (error: { code: string; message: string }) => void;
  }
): () => void {
  const controller = new AbortController();

  (async () => {
    try {
      const response = await fetch(`${API_BASE}${streamUrl}`, {
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        callbacks.onError({ code: 'HTTP_ERROR', message: `HTTP ${response.status}` });
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (line.startsWith(':')) continue; // 心跳注释行
          if (!line.startsWith('data: ')) continue;
          try {
            const chunk = JSON.parse(line.slice(6));
            if (chunk.type === 'delta') callbacks.onDelta(chunk.text ?? '');
            else if (chunk.type === 'done') callbacks.onDone();
            else if (chunk.type === 'error') callbacks.onError(chunk.error);
          } catch {
            // 跳过无法解析的行
          }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        callbacks.onError({ code: 'FETCH_ERROR', message: err.message });
      }
    }
  })();

  return () => controller.abort();
},
```

---

### 2.2 `GeneratorPage.vue` 创建任务后订阅 SSE

**文件**: `web/src/modules/chat/components/GeneratorPage.vue`

#### 修改点 1：维护流式文字 Map

```typescript
// script setup 顶部新增：
const streamTextMap = ref<Map<string, string>>(new Map());

function getStreamText(taskId: string): string {
  return streamTextMap.value.get(taskId) ?? '';
}
```

#### 修改点 2：`onGenerate` 根据 `streamUrl` 自动订阅 SSE

后端 `POST /api/tasks` 对 `executionMode === 'stream'` 的任务会在响应中携带 `streamUrl`，前端据此自动决定是否建立 SSE 连接。

```typescript
// 在 onGenerate 内，createTask 成功后：
const res = await taskApi.createTask(apiId, authProfileId, input);
if ((res as any)?.success) {
  const taskId = (res as any).data?.taskId;
  const streamUrl = (res as any).data?.streamUrl; // ✅ 后端返回的 SSE 链接

  await taskStore.fetchTasks(); // 先拉一次让 item 出现

  // ✅ 根据 streamUrl 是否存在自动订阅，无需再查 API executionMode
  if (streamUrl && taskId) {
    taskApi.subscribeStream(taskId, streamUrl, {
      onDelta(text) {
        const prev = streamTextMap.value.get(taskId) ?? '';
        streamTextMap.value.set(taskId, prev + text);
        streamTextMap.value = new Map(streamTextMap.value); // 触发响应式
      },
      onDone() {
        taskStore.fetchTasks(); // Worker 已写库，刷新获取完整 output
      },
      onError(err) {
        console.error(`[${taskId}] SSE 错误:`, err);
        taskStore.fetchTasks();
      },
    });
  }
}
```

#### 修改点 3：向 `ResourceTaskItem` 传递 streamText

```html
<!-- template 中的 ResourceTaskItem -->
<ResourceTaskItem
  :task="task"
  :stream-text="getStreamText(task.taskId || task.id)"
  @use-prompt="onUsePrompt"
  @regenerate="onRegenerate"
  @delete="onDeleteTask"
  @quote-task="onQuoteTask"
/>
```

---

### 2.3 `ResourceTaskItem.vue` 流式渲染与图文混排

**文件**: `web/src/modules/chat/components/ResourceTaskItem.vue`

#### 修改点 1：新增 `streamText` prop

```typescript
const props = defineProps<{
  task: any;
  streamText?: string; // 新增：流式累积文字
}>();
```

#### 修改点 2：新增 `streaming` displayStatus

```typescript
const displayStatus = computed(() => {
  const s = props.task.status;
  // running + stream executionMode = 正在流式输出
  if (s === 'running' && props.streamText !== undefined) return 'streaming';
  if (s === 'completed') return 'success';
  if (s === 'running' || s === 'polling' || s === 'polling-run') return 'processing';
  if (s === 'failed') return 'error';
  return 'pending';
});
```

#### 修改点 3：`streamSegments` computed — 实时解析图文块

```typescript
// 将流式累积文字解析为交替的 text/image 段
const streamSegments = computed(() => {
  const raw = props.streamText ?? '';
  if (!raw) return [];

  const IMAGE_REGEX =
    /!\[.*?\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/\S+\.(?:png|jpg|jpeg|webp|gif)(?:[?#]\S*)?)/gi;
  const segs: Array<{ type: 'text' | 'image'; value: string }> = [];
  let lastIndex = 0;
  let m: RegExpExecArray | null;

  while ((m = IMAGE_REGEX.exec(raw)) !== null) {
    const url = m[1] ?? m[0];
    if (m.index > lastIndex) {
      const txt = raw.slice(lastIndex, m.index).trim();
      if (txt) segs.push({ type: 'text', value: txt });
    }
    segs.push({ type: 'image', value: url });
    lastIndex = m.index + m[0].length;
  }
  const tail = raw.slice(lastIndex).trim();
  if (tail) segs.push({ type: 'text', value: tail });
  if (segs.length === 0) segs.push({ type: 'text', value: raw });
  return segs;
});
```

#### 修改点 4：模板新增 `streaming` 分支

在 `<template v-else-if="displayStatus === 'processing'">` 之后、`success` 之前插入：

```html
<template v-else-if="displayStatus === 'streaming'">
  <div class="min-h-[60px] space-y-2 rounded border border-indigo-100 bg-indigo-50/40 p-3">
    <template v-if="streamSegments.length > 0">
      <template v-for="(seg, idx) in streamSegments" :key="idx">
        <!-- 文字块 -->
        <p
          v-if="seg.type === 'text'"
          class="text-sm leading-relaxed whitespace-pre-wrap text-slate-700"
        >{{ seg.value }}<span
            v-if="idx === streamSegments.length - 1"
            class="ml-0.5 inline-block h-[1em] w-0.5 animate-pulse bg-indigo-500 align-middle"
          ></span>
        </p>
        <!-- 图片块（URL 完整后才渲染，检测 URL 末尾非 . 字符） -->
        <img
          v-else-if="/\.(png|jpg|jpeg|webp|gif)([?#].*)?$/i.test(seg.value)"
          :src="seg.value"
          class="max-w-full rounded shadow-sm"
          alt="生成的图片"
        />
      </template>
    </template>
    <!-- 空状态：还没收到任何内容 -->
    <div v-else class="flex items-center gap-1.5 text-xs text-slate-400">
      <span class="inline-block h-3.5 w-0.5 animate-pulse bg-indigo-400"></span>
      <span>生成中...</span>
    </div>
  </div>
</template>
```

---

## 三、注意事项

1. **`executeStream()` 只 yield delta** — `done` 事件由 Worker 的 `executeStreamHandler` 在迭代结束后统一发送。这样能确保 DB 已写入后再通知前端刷新，保证数据一致。

2. **StreamBus 缓冲机制** — Worker 可能比前端 SSE 连接早启动。缓冲区会将早到的 chunk 保留，订阅者到达后立即 flush，无数据丢失。

3. **图片 URL 渲染时机** — 模型可能将 URL 分多个 delta 吐出（如 `https://cdn` 和 `.example.com/img.png` 分开）。前端的正则匹配到完整 URL 后才渲染 `<img>`，避免请求中间态 URL。

4. **`getBaseUrl` / `getAuthHeaders`** — 若 `ApiExecutor` 未暴露这两个方法，需在 `api-executor.ts` 的 `ApiExecutor` 类中添加 public getter，`OpenAIChatGenerateImageApiHandler.executeStream()` 才能调用。

5. **日志记录** — `executeStreamHandler` 中的 `helpers.logger.info(...)` 会写入 Worker 日志文件（`logs/` 目录），包含任务 ID、耗时、字符数，满足完整流式文本可追溯的需求。若需要在 `task_runs_v2` 的 `api_call_logs` 字段中也存一份，可在 `repo.updateStatus` 的 output 中追加 `apiCallLogs: [{ fullText: accumulatedText }]`。

6. **agent 扩展点** — 后续接入 agent 时，只需在 `executeStream()` 生成器内部实现 tool_call 循环（接收 `finish_reason: 'tool_calls'` → 执行工具 → 继续 stream），整个 Worker 层无需改动，因为 Worker 只关心 yield 出来的 delta。
