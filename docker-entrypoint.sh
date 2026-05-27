#!/bin/bash
set -e

# Fix permissions on bind-mounted volumes (run as root before privilege drop)
# 宿主机 bind mount 常以 root 创建子目录，需递归 chown 供 UID 1001 (imohuan) 写入
mkdir -p /app/data/store /app/logs /agent/workspace /agent/.langgraph_api
chown -R imohuan:imohuan /app/data /app/logs /agent/workspace /agent/.langgraph_api

# 以 imohuan 身份启动两个服务
# agent 崩溃自动重启；主服务退出则容器停止
exec gosu imohuan bash -c '
  # Agent：崩溃后自动重启（后台循环）
  while true; do
    cd /agent && node ./node_modules/.bin/langgraphjs dev --port 2024 --host 127.0.0.1 --no-browser || true
    echo "[agent] crashed, restarting in 3s..."
    sleep 3
  done &

  # 主服务：前台运行，退出则容器停止
  cd /app && exec bun start
'
