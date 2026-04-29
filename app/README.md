# Cloud Task - 第三方 API 接入中台

## 快速开始

### 安装依赖

```bash
cd app
bun install
```

### 配置环境变量

复制 `.env.example` 为 `.env` 并填写配置：

```bash
cp .env.example .env
```

### 启动开发服务器

```bash
bun run dev
```

### 访问服务

- HTTP API: http://localhost:3000
- Swagger 文档: http://localhost:3000/docs
- 健康检查: http://localhost:3000/health

## 架构说明

本项目采用 **Core / Platforms / Adapters / App** 分层架构：

### Core（核心层）

纯 TypeScript 业务内核，不依赖任何 Web 框架：

- `contracts/`: 字段定义协议、类型定义
- `domain/`: 基类（平台、认证、API 处理器）
- `ports/`: 端口接口（仓储、任务分发、HTTP 客户端）
- `application/`: 应用层（注册中心、用例）

### Platforms（平台实现）

各平台的具体实现：

- `yunwu/`: 云雾平台
  - 认证策略
  - API 处理器
  - 平台提供者

### Adapters（适配层）

可替换的技术实现：

- `http-elysia/`: Elysia HTTP 适配器
  - Registry 路由
  - Invoke 路由
  - Task 路由
  - Auth Profile 路由

### App（启动层）

依赖注入与进程启动：

- `index.ts`: 启动入口

## 核心概念

### 平台 -> 分类 -> 接口

```
云雾平台 (yunwu)
  └─ 图片生成 (yunwu.image)
      ├─ 图片生成 (yunwu.image.generate) [async]
      └─ 任务查询 (yunwu.image.query) [sync]
```

### 接口元数据

每个接口都能返回：

- **输入字段定义**：供前端渲染表单
- **输出字段定义**：供前端展示结果
- **认证需求**：需要的认证策略

### 执行模式

- **sync**: 同步调用，直接返回结果
- **async**: 异步任务，返回任务 ID

## API 示例

### 查询平台列表

```bash
GET /api/registry/platforms
```

### 查询 API 详情

```bash
GET /api/registry/apis/yunwu.image.generate
```

### 调用同步接口

```bash
POST /api/invoke/yunwu.image.query
{
  "authProfileId": "profile-1",
  "input": {
    "taskId": "task-123"
  }
}
```

### 创建异步任务

```bash
POST /api/tasks
{
  "apiId": "yunwu.image.generate",
  "authProfileId": "profile-1",
  "input": {
    "prompt": "一只可爱的猫咪",
    "width": 512,
    "height": 512
  }
}
```

## 添加新平台

1. 在 `src/platforms/` 下创建平台目录
2. 继承 `BasePlatformProvider` 实现平台提供者
3. 继承 `BaseAuthStrategy` 实现认证策略
4. 继承 `BaseApiHandler` 实现接口处理器
5. 创建注册函数并在 `index.ts` 中调用

## 切换 HTTP 框架

核心逻辑与框架解耦，可以轻松切换：

1. 实现新的 HTTP 适配器（如 `http-express/`）
2. 修改 `src/index.ts` 使用新适配器
3. 无需修改 `core/` 和 `platforms/` 代码

## 技术栈

- 运行时: Bun
- HTTP 框架: Elysia（可替换）
- 数据库: Neon PostgreSQL（待实现）
- 任务队列: 自研数据库任务队列（PostgreSQL 已实现，SQLite 适配器预留）
