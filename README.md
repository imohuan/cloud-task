# Docker 部署指南

## 目录结构

```
cloud-task/
├── Dockerfile           # 多阶段构建：前端(pnpm) + 后端(bun)
├── docker-compose.yml   # 容器编排配置
├── .dockerignore
├── app/                 # 后端源码 (Bun + Elysia)
├── web/                 # 前端源码 (Vue3 + Vite)
├── data/                # SQLite 数据库（运行后自动创建）
└── logs/                # 日志文件（运行后自动创建）
```

> 前端构建产物由 Dockerfile 多阶段构建直接内嵌到镜像中，无需单独维护 `public/` 目录。

---

## 快速开始（SQLite 模式）

```bash
docker compose up -d --build
```

访问 http://localhost:3000

---

## 切换数据库模式

### SQLite 模式（默认，无需额外配置）

`docker-compose.yml` 中已默认启用，数据库文件持久化到 `./data/app.db`。

### PostgreSQL 模式

编辑 `docker-compose.yml`，修改 `environment` 部分：

```yaml
environment:
  # 注释掉 SQLite 配置
  # TASK_QUEUE_DRIVER: sqlite
  # SQLITE_DB_PATH: /app/data/app.db
  # 启用 Postgres
  DATABASE_URL: "postgresql://user:password@host/dbname?sslmode=require"
```

---

## 更新部署

前端或后端代码有变更后，重新构建并重启即可：

```bash
git pull && docker compose down -v && docker compose up -d --build
```

---

## 常用命令

```bash
# 查看实时日志
docker compose logs -f

# 停止容器
docker compose down

# 停止并清除持久化数据
docker compose down -v && rm -rf ./data ./logs

# 进入容器调试
docker exec -it cloud-task sh
```

---

## 环境变量说明

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `NODE_ENV` | `production` | 运行环境 |
| `PORT` | `3000` | 监听端口 |
| `DATABASE_URL` | — | PostgreSQL 连接串（postgres 模式必填） |
| `TASK_QUEUE_DRIVER` | `postgres` | 队列驱动：`postgres` 或 `sqlite` |
| `SQLITE_DB_PATH` | `data/app.db` | SQLite 文件路径 |
| `ENABLE_WORKER` | `true` | 是否启用任务消费器 |
| `WORKER_CONCURRENCY` | `3` | 并发任务数 |
| `TASK_MAX_ATTEMPTS` | `3` | 任务最大重试次数 |
| `LOG_LEVEL` | `info` | 日志级别：`debug` \| `info` \| `warn` \| `error` |
| `LOG_ENABLE_FILE` | `false` | 是否写入日志文件 |
| `LOG_DIR` | `logs/` | 日志目录 |

---

## 数据持久化说明

| 宿主机目录 | 容器路径 | 说明 |
|------------|----------|------|
| `./data` | `/app/data` | SQLite 数据库，自动创建 |
| `./logs` | `/app/logs` | 日志文件，自动创建 |
