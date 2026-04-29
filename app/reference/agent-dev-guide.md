# Agent 开发指导文档

## 概述

本文档指导如何为云雾平台开发新的 API Handler。以 `app/src/platforms/yunwu/categories/image/generate-image.api.ts` 为模板，新增一个接口只需关注 **3 个文件** 的修改。

---

## 开发步骤

### 1. 创建 API Handler 文件

**位置**: `app/src/platforms/yunwu/categories/<分类>/<功能名>.api.ts`

**核心结构**（按顺序编写）：

1. **引入依赖** — `BaseApiHandler`、类型、`createApiExecutor`
2. **创建 executor** — `createApiExecutor('<HandlerName>')`
3. **定义 Input / Output 接口** — 描述请求参数和响应结构
4. **导出 Handler 类** — 继承 `BaseApiHandler<TInput, TOutput>`
5. **实现 `getMetadata()`** — 填写 API 元数据、输入输出字段定义
6. **实现 `execute()`** — 使用 executor 编写执行逻辑

#### execute() 编写要点

```
const input = context.input as YourInput;
const ctx = executor.createContext(context, authContext);
const { logger } = executor;

logger.info(`[${ctx.taskRunId}] 开始xxx任务`, { ... });

return executor.execute<YourInput, YourOutput>(
  ctx,
  input,
  (input) => ({
    path: '/your/api/path',    // 请求路径（会拼接到 baseUrl 后）
    body: { ... },              // 请求体，从 input 构建
  }),
  {
    validateResponse: (data) => boolean | string,  // 返回 true 或错误消息
    onSuccess: (data) => data,                      // 可选，对结果做后处理
    errorCode: 'YOUR_ERROR_CODE',
    errorMessage: '你的错误描述',
  }
);
```

**executor 提供的能力**：

| 能力 | 说明 |
|------|------|
| `createContext()` | 自动提取 taskRunId、初始化 sql/logger/startTime |
| `execute()` | 完整流程：进度更新 → HTTP 请求 → 验证 → 后处理 → 错误处理 |
| `request<T>()` | 单独发 HTTP 请求（如需要多步调用时使用） |
| `updateProgress()` | 手动更新任务进度（`autoUpdateProgress` 可关闭自动进度） |
| `getAuthHeaders()` / `getBaseUrl()` | 获取认证信息和 API 地址 |

---

### 2. 注册到平台模块

**文件**: `app/src/platforms/yunwu/index.ts`

需要做 3 处修改：

1. **import** — 引入新的 Handler 类
2. **export** — 导出该类
3. **registerYunwuPlatform()** — 实例化并调用 `registry.registerApiHandler('yunwu', '<categoryId>', handler)`

其中 `categoryId` 对应 `yunwu.platform.ts` 中定义的分类 id（如 `image`、`voice`）。

---

### 3. 更新平台分类（如需要新分类）

**文件**: `app/src/platforms/yunwu/yunwu.platform.ts`

在 `getCategories()` 数组中添加新分类：

- `id` — 分类标识（如 `voice`），与注册时使用的 categoryId 一致
- `name` — 分类显示名
- `description` — 分类描述
- `icon` — 图标标识
- `order` — 排序权重

如果新接口属于已有分类（如 `image`），则无需修改此文件。

---

## 目录结构参考

```
platforms/yunwu/
├── yunwu.platform.ts          # 平台定义 & 分类列表
├── index.ts                   # 注册入口
├── auth/
│   └── yunwu-api-key.auth.ts  # 认证策略
└── categories/
    ├── image/
    │   ├── generate-image.api.ts
    │   └── query-image-task.api.ts
    └── voice/                  # 新增分类示例
        └── tts.api.ts          # 新增接口示例
```

---

## 注意事项

- **executor 是模块级单例**，在文件顶层创建一次即可，不要在方法内创建
- **logger 通过解构使用**：`const { logger } = executor;`，然后 `logger.info()`
- **请求路径** 只需写相对路径（如 `/images/generations`），baseUrl 由 authContext 自动提供
- **超时时间** 默认取配置 `server.requestTimeoutMs`，可通过 `createApiExecutor(name, { timeoutMs })` 覆盖
- **进度更新** 默认自动管理（10% → 90%），如需自定义可在 `execute()` 前后调用 `updateProgress()`
- **命名规范**：文件名用 kebab-case（如 `tts.api.ts`），类名用 PascalCase（如 `TtsApiHandler`）
