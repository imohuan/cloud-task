#!/usr/bin/env bash
# Ubuntu/Linux：结束所有名为 node 的进程（对应 Windows 下 kill-ports.bat）

echo "Killing all Node.js processes..."
if killall node 2>/dev/null; then
  echo "Done."
else
  echo "No Node.js processes found."
fi

rm -rf data/.langgraph_api