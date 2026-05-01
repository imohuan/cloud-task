# ==================== Stage 1: Build Frontend ====================
FROM node:22-slim AS web-builder

RUN npm install -g pnpm

WORKDIR /build

# 先复制依赖描述文件，充分利用 Docker 层缓存
COPY web/package.json web/pnpm-lock.yaml ./

RUN HUSKY=0 pnpm install --frozen-lockfile

# 复制前端源码并构建
COPY web/ ./

RUN pnpm run build

# ==================== Stage 2: Backend Runtime ====================
FROM oven/bun:1

# 创建非 root 用户 imohuan（UID 1001），安装 gosu 用于 entrypoint 降权
RUN groupadd --gid 1001 imohuan && \
    useradd --uid 1001 --gid 1001 --no-create-home imohuan && \
    apt-get update && apt-get install -y --no-install-recommends gosu && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 先复制依赖描述文件，充分利用 Docker 层缓存
COPY app/package.json app/bun.lock ./

RUN bun install --production

# 复制后端源码
COPY app/ .

# 将前端构建产物复制到后端静态目录（覆盖 app/public/）
COPY --from=web-builder /build/dist ./public

# ==================== Agent Service ====================
WORKDIR /agent

# 先复制依赖描述文件，充分利用 Docker 层缓存
COPY agent/package.json agent/bun.lock ./

RUN bun install

# 复制 agent 源码
COPY agent/ ./

WORKDIR /app

# 移交目录所有权
RUN chown -R imohuan:imohuan /app /agent

# Entrypoint：以 root 修复挂载卷权限，再降权到 imohuan 运行
COPY docker-entrypoint.sh ./
RUN chmod +x /app/docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
# 两个服务均由 docker-entrypoint.sh 管理：app(3000) + agent(2024)
