# Docker 部署指南

## 目录结构

```
cloud-task/
├── Dockerfile           # 多阶段构建：前端(pnpm) + 后端(bun)
├── docker-compose.yml       # 本地构建编排
├── docker-compose.ghcr.yml  # 使用 GHCR 预构建镜像
├── .github/workflows/docker-publish.yml
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

## 发布镜像（GHCR）

推送符合 `v*` 格式的 Git tag 时，GitHub Actions 会自动构建并发布到 [GitHub Container Registry](https://docs.github.com/zh/packages/working-with-a-github-packages-registry/working-with-the-container-registry)（`ghcr.io`）。

### 发布新版本

```bash
git tag v1.0.0
git push origin v1.0.0
```

工作流见 [`.github/workflows/docker-publish.yml`](.github/workflows/docker-publish.yml)。构建完成后可在仓库 **Packages** 页面查看镜像。

镜像地址：`ghcr.io/imohuan/cloud-task`

| Tag 示例 | 说明 |
|----------|------|
| `1.0.0` | 语义化版本（去掉 `v` 前缀） |
| `1.0` / `1` | 主次版本别名 |
| `v1.0.0` | 与 Git tag 同名 |
| `latest` | 最近一次 tag 发布 |
| `<sha>` | 对应提交的短标签 |

### 在其他云平台拉取部署

**公开仓库**：可直接拉取，无需登录。

```bash
docker pull ghcr.io/imohuan/cloud-task:1.0.0
```

**私有仓库**：需使用具备 `read:packages` 的 Personal Access Token 登录：

```bash
echo "$GITHUB_TOKEN" | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
```

在服务器上克隆本仓库后，使用预构建镜像编排（无需本地 build）：

```bash
# 复制环境变量模板并按需填写
cp .env.example .env   # 若存在；否则自行 export 所需变量

IMAGE_TAG=1.0.0 docker compose -f docker-compose.ghcr.yml up -d
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
  ghcr.io/imohuan/cloud-task:1.0.0
```

> 首次发布若 Packages 不可见，请在仓库 **Settings → Actions → General** 中确认 Workflow 拥有写入 packages 的权限（本仓库工作流已声明 `packages: write`）。

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
