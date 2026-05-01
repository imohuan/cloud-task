#!/bin/bash
set -e

# Fix permissions on bind-mounted volumes (run as root before privilege drop)
mkdir -p /app/data /app/logs
chown imohuan:imohuan /app/data /app/logs

# 以 imohuan 身份启动两个服务
# agent 崩溃自动重启；主服务退出则容器停止
exec gosu imohuan bash -c '
  # Agent：崩溃后自动重启（后台循环）
  while true; do
    cd /agent && bun dev-cloud || true
    echo "[agent] crashed, restarting in 3s..."
    sleep 3
  done &

  # 主服务：前台运行，退出则容器停止
  cd /app && exec bun start
'
