# 异步轮询任务开发指导文档

## 概述

本文档指导如何为云雾平台开发需要**后台自动轮询第三方 API** 的异步任务 Handler。以 Grok 视频生成为例，这类任务的特点是：

- 调用第三方创建接口后，**不会立即返回最终结果**
- 需要后台**定时轮询**第三方查询接口获取最终状态
- 服务器重启后需要**自动恢复**轮询

---

## 核心概念

### 任务状态流转

```
pending → running → polling → completed
                          → failed
```

| 状态 | 含义 |
|------|------|
| `pending` | 等待 Worker 领取 |
| `running` | Worker 正在执行 handler |
| `polling` | 已发起第三方请求，等待异步结果，需要定时轮询 |
| `completed` | 最终完成 |
| `failed` | 最终失败 |

### `next_poll_at` 字段

数据库 `task_runs_v2` 表新增 `next_poll_at` 列，用于控制轮询频率：

- 当 `status = 'polling'` 时，`next_poll_at` 表示"下次最早可轮询时间"
- Worker 每秒循环查询数据库，但只取 `next_poll_at <= now()` 的任务
- 轮询完成后更新 `next_poll_at`，任务回到 `polling` 状态
- 不同 Handler 可配置不同的轮询间隔

---

## 开发步骤

### 1. 数据库表变更

```sql
-- task_runs_v2 新增 next_poll_at 列
ALTER TABLE task_runs_v2 ADD COLUMN next_poll_at TEXT;

-- 为 polling 任务建立索引
CREATE INDEX idx_task_runs_polling ON task_runs_v2(status, next_poll_at) WHERE status = 'polling';
```

---

### 2. 创建 API Handler 文件

**位置**: `app/src/platforms/yunwu/categories/<分类>/<功能名>.api.ts`

**核心结构**（按顺序编写）：

1. **引入依赖** — `BaseApiHandler`、类型、`createApiExecutor`
2. **创建 executor** — `createApiExecutor('<HandlerName>')`
3. **定义 Input / Output 接口** — 描述请求参数和响应结构
4. **导出 Handler 类** — 继承 `BaseApiHandler<TInput, TOutput>`
5. **实现 `getMetadata()`** — 填写 API 元数据
6. **实现 `getPollingConfig()`** — 配置轮询策略（新增！）
7. **实现 `execute()`** — 调用第三方创建接口
8. **实现 `poll()`** — 调用第三方查询接口（新增！）

#### execute() 编写要点

```typescript
async execute(context, authContext) {
  const input = context.input as YourInput;
  const ctx = executor.createContext(context, authContext);

  return executor.execute<YourInput, CreateOutput, StandardApiOutput>(
    ctx,
    input,
    (input) => ({
      path: '/video/create',
      body: { ... },
    }),
    {
      validateResponse: (data) => data.id ? true : '未返回任务ID',
      onSuccess: (data) => ({
        content: [],
        raw: data,
        // 关键：返回 _polling 标识，告诉系统需要后续轮询
        _polling: {
          thirdPartyTaskId: data.id,
          pollingPhase: 'video_create',
        },
      }),
      errorCode: 'VIDEO_CREATE_FAILED',
      errorMessage: '视频创建失败',
    }
  );
}
```

**`onSuccess` 中必须返回 `_polling` 对象**，包含：
- `thirdPartyTaskId` — 第三方任务 ID，后续轮询查询用
- `pollingPhase` — 轮询阶段标识（支持多阶段轮询）

#### poll() 编写要点

```typescript
async poll(context, authContext, pollingState) {
  const ctx = executor.createContext(context, authContext);
  const { thirdPartyTaskId } = pollingState;

  // 调用第三方查询接口
  const result = await executor.request<QueryOutput>(ctx, {
    path: `/video/query?id=${thirdPartyTaskId}`,
    method: 'GET',
  });

  // 判断第三方状态
  if (result.status === 'completed' && result.video_url) {
    // 完成：返回最终结果
    return {
      success: true,
      data: {
        content: [{ type: 'video', url: result.video_url }],
        raw: result,
      },
    };
  }

  if (result.status === 'failed') {
    // 第三方失败
    return {
      success: false,
      error: {
        code: 'THIRD_PARTY_FAILED',
        message: result.error || '第三方任务失败',
      },
    };
  }

  // 仍在处理中：返回 continue，系统会自动计算下次轮询时间
  return {
    success: true,
    data: {
      _continuePolling: true,
      raw: result,
    },
  };
}
```

**poll() 返回值**：
- `success: true` + 有最终数据 → 任务标记为 `completed`
- `success: false` → 任务标记为 `failed`
- `success: true` + `_continuePolling: true` → 任务回到 `polling`，等待下次轮询

#### getPollingConfig() 编写要点

```typescript
getPollingConfig(): PollingConfig {
  return {
    intervalMs: 15000,         // 基础间隔 15 秒
    maxPollCount: 480,         // 最多轮询 480 次（约 2 小时）
    backoffStrategy: 'exponential',
    backoffMultiplier: 1.3,    // 每 5 次轮询间隔 ×1.3
    maxIntervalMs: 300000,     // 最长间隔 5 分钟
  };
}
```

---

### 3. 注册到平台模块

**文件**: `app/src/platforms/yunwu/index.ts`

与同步/普通异步任务相同，3 处修改：import、export、register。

---

### 4. 更新平台分类（如需要新分类）

**文件**: `app/src/platforms/yunwu/yunwu.platform.ts`

在 `getCategories()` 数组中添加新分类（如 `video`）。

---

## 完整示例：Grok 视频生成

```typescript
import { BaseApiHandler } from '@core/domain/api/base-api.handler';
import type { ApiCallContext, ApiMetadata, SyncApiResult } from '@core/contracts/api.types';
import type { AuthContext } from '@core/contracts/auth.types';
import { createApiExecutor, createStandardOutputSchema, type StandardApiOutput } from '@core/application/api-executor';
import type { PollingConfig, PollingState } from '@core/domain/api/base-api.handler';

const executor = createApiExecutor('GrokGenerateVideo');

// ========== 类型定义 ==========

interface GrokGenerateVideoInput {
  model?: string;
  prompt: string;
  aspect_ratio?: string;
  size?: string;
  images?: string[];
}

interface VideoCreateOutput {
  id: string;
  status: string;
  status_update_time: number;
}

interface VideoQueryOutput {
  id: string;
  status: string;
  video_url?: string;
  enhanced_prompt?: string;
  status_update_time: number;
}

// ========== Handler ==========

export class GrokGenerateVideoApiHandler extends BaseApiHandler<GrokGenerateVideoInput, StandardApiOutput> {
  getMetadata(): ApiMetadata {
    return {
      id: 'grok-video',
      name: 'Grok 视频生成',
      description: '根据文本描述或图片生成视频（支持 grok-video-3 模型），需要后台轮询获取结果',
      authStrategyId: 'api-key',
      executionMode: 'async',
      enabled: true,
      version: '1.0.0',
      tags: ['video', 'generation', 'ai', 'grok', 'polling'],
      inputSchema: {
        description: 'Grok 视频生成参数',
        fields: [
          {
            name: 'model',
            type: 'string',
            required: false,
            description: '用于生成视频的模型',
            defaultValue: 'grok-video-3',
            enumValues: [
              { label: 'Grok Video 3', value: 'grok-video-3' },
            ],
            uiHint: 'select',
            abilities: [{ name: 'model' }],
          },
          {
            name: 'prompt',
            type: 'string',
            required: true,
            description: '视频描述文本，最大长度 4000 字符',
            minLength: 1,
            maxLength: 4000,
            uiHint: 'textarea',
            abilities: [{ name: 'prompt' }],
          },
          {
            name: 'aspect_ratio',
            type: 'string',
            required: false,
            description: '视频宽高比',
            defaultValue: '3:2',
            enumValues: [
              { label: '3:2', value: '3:2' },
              { label: '2:3', value: '2:3' },
              { label: '1:1', value: '1:1' },
            ],
            uiHint: 'select',
            abilities: [{ name: 'aspect_ratio', group: 'dimension' }],
          },
          {
            name: 'size',
            type: 'string',
            required: false,
            description: '视频分辨率',
            defaultValue: '720P',
            enumValues: [
              { label: '720P', value: '720P' },
              { label: '1080P', value: '1080P' },
            ],
            uiHint: 'select',
            abilities: [{ name: 'size', group: 'dimension' }],
          },
          {
            name: 'images',
            type: 'array',
            required: false,
            description: '参考图片 URL 数组（可选，用于图生视频）',
            uiHint: 'image-list',
            abilities: [{ name: 'image' }],
          },
        ],
        layout: {
          rows: [
            { fields: ['model', 'aspect_ratio', 'size'] },
            { fields: ['prompt'] },
            { fields: ['images'] },
          ],
          fieldConfig: {
            prompt: { colSpan: 1 },
            images: { colSpan: 1 },
          },
        },
      },
      outputSchema: createStandardOutputSchema('Grok 视频生成标准化输出', [
        { name: 'id', type: 'string', required: true, description: '第三方任务ID' },
        { name: 'status', type: 'string', required: true, description: '任务状态' },
        { name: 'video_url', type: 'string', required: false, description: '生成的视频URL（完成后可用）' },
      ]),
    };
  }

  getPollingConfig(): PollingConfig {
    return {
      intervalMs: 15000,
      maxPollCount: 480,
      backoffStrategy: 'exponential',
      backoffMultiplier: 1.3,
      maxIntervalMs: 300000,
    };
  }

  async execute(
    context: ApiCallContext,
    authContext: AuthContext
  ): Promise<SyncApiResult<StandardApiOutput>> {
    const input = context.input as GrokGenerateVideoInput;
    const ctx = executor.createContext(context, authContext);
    const { logger } = executor;

    logger.info(`[${ctx.taskRunId}] 开始 Grok 视频创建任务`, {
      model: input.model,
      prompt: input.prompt,
    });

    return executor.execute<GrokGenerateVideoInput, VideoCreateOutput, StandardApiOutput>(
      ctx,
      input,
      (input) => {
        const body: Record<string, unknown> = {
          model: input.model ?? 'grok-video-3',
          prompt: input.prompt,
        };
        if (input.aspect_ratio) body.aspect_ratio = input.aspect_ratio;
        if (input.size) body.size = input.size;
        if (input.images && input.images.length > 0) body.images = input.images;

        return {
          path: '/video/create',
          body,
        };
      },
      {
        validateResponse: (data) => {
          if (!data.id) return 'API 未返回任务ID';
          return true;
        },
        onSuccess: (data) => {
          logger.info(`[${ctx.taskRunId}] 视频创建成功，第三方任务ID: ${data.id}`);
          return {
            content: [],
            raw: data,
            _polling: {
              thirdPartyTaskId: data.id,
              pollingPhase: 'video_create',
            },
          };
        },
        errorCode: 'VIDEO_CREATE_FAILED',
        errorMessage: '视频创建失败',
      }
    );
  }

  async poll(
    context: ApiCallContext,
    authContext: AuthContext,
    pollingState: PollingState
  ): Promise<SyncApiResult<StandardApiOutput>> {
    const ctx = executor.createContext(context, authContext);
    const { logger } = executor;
    const { thirdPartyTaskId } = pollingState;

    logger.info(`[${ctx.taskRunId}] 轮询视频任务状态`, { thirdPartyTaskId });

    try {
      const response = await executor.request<VideoQueryOutput>(ctx, {
        path: `/video/query?id=${thirdPartyTaskId}`,
        method: 'GET',
      });

      logger.debug(`[${ctx.taskRunId}] 轮询结果`, { status: response.status });

      // 第三方已完成
      if (response.status === 'completed' && response.video_url) {
        logger.info(`[${ctx.taskRunId}] 视频生成完成`, { videoUrl: response.video_url });
        return {
          success: true,
          data: {
            content: [{ type: 'video' as const, url: response.video_url }],
            raw: response,
          },
        };
      }

      // 第三方失败
      if (response.status === 'failed') {
        logger.warn(`[${ctx.taskRunId}] 第三方任务失败`);
        return {
          success: false,
          error: {
            code: 'THIRD_PARTY_FAILED',
            message: '第三方视频生成任务失败',
          },
        };
      }

      // 仍在处理中，继续轮询
      logger.info(`[${ctx.taskRunId}] 视频仍在处理中，继续轮询`, { status: response.status });
      return {
        success: true,
        data: {
          _continuePolling: true,
          raw: response,
        },
      };
    } catch (error: any) {
      logger.error(`[${ctx.taskRunId}] 轮询请求失败`, error);
      return {
        success: false,
        error: {
          code: 'POLL_REQUEST_FAILED',
          message: error.message || '轮询请求失败',
        },
      };
    }
  }
}
```

---

## 系统层改动（已由框架完成）

以下改动在框架层统一实现，开发新 Handler 时**不需要关心**：

### 1. claimNextTask SQL 扩展

```sql
-- SQLite
SELECT id, api_id, auth_profile_id, input_payload, retry_count,
       status AS origin_status
FROM task_runs_v2
WHERE status = 'pending'
   OR (status = 'polling' AND next_poll_at <= datetime('now'))
ORDER BY 
  CASE WHEN status = 'pending' THEN 0 ELSE 1 END,
  created_at ASC
LIMIT 1;

UPDATE task_runs_v2
SET status = 'running',
    started_at = CASE WHEN status = 'pending' THEN datetime('now') ELSE started_at END,
    progress = CASE WHEN progress IS NULL OR progress < 5 THEN 5 ELSE progress END,
    worker_info = ?1
WHERE id = ?2;
```

### 2. defaultTaskHandler 增加 poll 分支

```typescript
// 步骤 7：执行 handler
if (originStatus === 'polling') {
  // 恢复轮询
  result = await handler.poll(context, authContext, pollingState);
} else {
  // 正常执行
  result = await handler.execute(context, authContext);
}

// 结果处理
if (result.success && result.data?._polling) {
  // 需要继续轮询
  await repo.updateStatus(taskRunId, 'polling', {
    output: { ...result.data.raw, ...result.data._polling, pollCount: 0 },
    progress: 30,
  });
} else if (result.success && result.data?._continuePolling) {
  // poll() 返回继续轮询
  const nextPollAt = calculateNextPollAt(pollCount, pollingConfig);
  await repo.updateStatus(taskRunId, 'polling', {
    output: { ...output, pollCount: pollCount + 1, nextPollAt },
    progress: Math.min(30 + pollCount * 2, 90),
  });
} else if (result.success) {
  // 最终完成
  await repo.updateStatus(taskRunId, 'completed', { ... });
}
```

### 3. releaseStaleTasks 排除 polling 来源

```sql
-- 只对非 polling 来源的 running 任务做超时检查
WHERE status = 'running'
  AND next_poll_at IS NULL          -- 排除正在轮询的任务
  AND started_at < ?2
```

---

## 注意事项

1. **`execute()` 的 `onSuccess` 必须返回 `_polling`** — 否则系统不知道需要轮询
2. **`poll()` 返回 `_continuePolling: true`** — 系统会自动计算下次轮询时间
3. **`output_payload` 保留原有属性** — poll 更新时只添加新属性（`pollCount`、`nextPollAt`、`lastPollResult` 等），不删除原有数据
4. **`getPollingConfig()` 是可选的** — 不实现则使用默认配置（15 秒间隔，最多 480 次）
5. **超时保护** — 超过 `maxPollCount` 后任务自动标记为 `failed`（系统层处理）
6. **服务器重启恢复** — 所有轮询状态持久化在数据库，Worker 启动后自动恢复
