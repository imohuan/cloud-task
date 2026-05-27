# Docker 部署指南

## 目录结构

```
cloud-task/
├── Dockerfile               # 多阶段构建：前端(pnpm) + 后端(bun)（CI 使用）
├── docker-compose.ghcr.yml  # 使用 GHCR 预构建镜像部署
├── .github/workflows/docker-publish.yml
├── .dockerignore
├── app/                     # 后端源码 (Bun + Elysia)
├── web/                     # 前端源码 (Vue3 + Vite)
├── data/                    # SQLite 数据库（运行后自动创建）
└── logs/                    # 日志文件（运行后自动创建）
```

> 前端构建产物由 Dockerfile 多阶段构建内嵌到镜像中。日常部署请使用 GHCR 预构建镜像，无需本地 `docker build`。

---

## 快速开始（GHCR 预构建镜像）

```bash
cp .env.example .env   # 按需编辑

mkdir -p data/store logs workspace data/.langgraph_api
chown -R 1001:1001 data logs workspace   # Linux 首次部署

docker compose -f docker-compose.ghcr.yml up -d
```

访问 http://localhost:3000

---

## 发布镜像（GHCR）

推送符合 `v*` 格式的 Git tag 时，GitHub Actions 会自动构建并发布到 [GitHub Container Registry](https://docs.github.com/zh/packages/working-with-a-github-packages-registry/working-with-the-container-registry)（`ghcr.io`）。

### 发布新版本

```bash
git tag v1.0.0
git push origin v1.0.0
```

工作流见 [`.github/workflows/docker-publish.yml`](.github/workflows/docker-publish.yml)。构建完成后可在仓库 **Packages** 页面查看镜像。

镜像地址：`ghcr.io/imohuan/cloud-task:latest`

无论推送 `v1.0.0` 还是 `v2.0.0`，CI 均覆盖发布到 **同一镜像 tag `latest`**。Git tag 仅用于触发构建；具体版本可在 GHCR 包详情或镜像 OCI 标签中查看。

### 在其他云平台拉取部署

**公开仓库**：可直接拉取，无需登录。

```bash
docker pull ghcr.io/imohuan/cloud-task:latest
```

**私有仓库**：需使用具备 `read:packages` 的 Personal Access Token 登录：

```bash
echo "$GITHUB_TOKEN" | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
```

在服务器上克隆本仓库后部署：

```bash
cp .env.example .env

mkdir -p data/store logs workspace data/.langgraph_api
chown -R 1001:1001 data logs workspace

docker compose -f docker-compose.ghcr.yml up -d
```

仅拉镜像、不用 compose 时：

```bash
docker run -d --name cloud-task \
  -p 3000:3000 \
  -v "$(pwd)/data:/app/data" \
  -v "$(pwd)/logs:/app/logs" \
  -v "$(pwd)/workspace:/agent/workspace" \
  -e TASK_QUEUE_DRIVER=sqlite \
  -e SQLITE_DB_PATH=/app/data/store/app.db \
  ghcr.io/imohuan/cloud-task:latest
```

> 首次发布若 Packages 不可见，请在仓库 **Settings → Actions → General** 中确认 Workflow 拥有写入 packages 的权限（本仓库工作流已声明 `packages: write`）。

---

## 切换数据库模式

### SQLite 模式（默认）

`docker-compose.ghcr.yml` 中已默认启用，数据库文件持久化到 `./data/store/app.db`。

### PostgreSQL 模式

编辑 `docker-compose.ghcr.yml` 的 `environment` 部分：

```yaml
environment:
  # 注释掉 SQLite 配置
  # TASK_QUEUE_DRIVER: sqlite
  # SQLITE_DB_PATH: /app/data/store/app.db
  # 启用 Postgres
  DATABASE_URL: "postgresql://user:password@host/dbname?sslmode=require"
```

---

## 更新部署

拉取新镜像并重启（无需本地 build）：

```bash
git pull
docker compose -f docker-compose.ghcr.yml pull
docker compose -f docker-compose.ghcr.yml up -d
```

---

## 常用命令

```bash
# 查看实时日志
docker compose -f docker-compose.ghcr.yml logs -f

# 停止容器
docker compose -f docker-compose.ghcr.yml down

# 停止并清除持久化数据（慎用）
docker compose -f docker-compose.ghcr.yml down -v && rm -rf ./data ./logs

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
