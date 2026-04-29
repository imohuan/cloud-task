# Docker 部署指南

## 目录结构

```
cloud-task/
├── Dockerfile           # 多阶段构建：前端(pnpm) + 后端(bun)
├── docker-compose.yml   # 容器编排配置
├── .dockerignore
├── app/                 # 后端源码 (Bun + Elysia)
├── web/                 # 前端源码 (Vue3 + Vite)
├── public/              # 前端构建产物（挂载到容器，首次需初始化）
├── data/                # SQLite 数据库（自动创建）
└── logs/                # 日志文件（自动创建）
```

---

## 快速开始（SQLite 模式）

### 1. 构建镜像 + 初始化 public/ 目录（首次必须执行）

`./public` 是 bind mount，宿主机目录为空会覆盖容器内的前端文件，需先提取：

```bash
# 构建镜像
docker compose build

# 从镜像中提取前端文件到宿主机 ./public/
docker create --name tmp cloud-task
docker cp tmp:/app/public ./public
docker rm tmp
```

### 2. 启动容器

```bash
docker compose up -d
```

访问 http://localhost:3000

---

## 切换数据库模式

### SQLite 模式（默认，无需额外配置）

`docker-compose.yml` 中已默认启用，数据库文件存储在 `./data/app.db`。

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

## 常用命令

```bash
# 构建并启动
docker compose up -d --build

# 查看日志
docker compose logs -f

# 停止容器
docker compose down

# 停止并删除数据卷
docker compose down -v

# 进入容器
docker exec -it cloud-task sh
```

---

## 更新前端（重新部署）

前端代码变更后，需要重新构建镜像并刷新 `public/` 目录：

```bash
# 重新构建镜像
docker compose build

# 提取新的前端文件（覆盖宿主机 ./public/）
docker create --name tmp cloud-task
docker cp tmp:/app/public ./public
docker rm tmp

# 重启容器
docker compose up -d
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
| `./public` | `/app/public` | 前端静态文件，**首次需手动初始化** |
| `./data` | `/app/data` | SQLite 数据库，自动创建 |
| `./logs` | `/app/logs` | 日志文件，自动创建 |

> **注意**：`./public` 目录在重新构建镜像后不会自动更新，需手动执行"更新前端"步骤。
