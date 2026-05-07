import { ref, watch, type Ref } from "vue";
import { taskApi, API_BASE } from "@/api";
import { useSse } from "@/composables/useSse";
import type { useTaskStore } from "@/stores/useTaskStore";

export function useTaskSseRefresh(
  taskStore: ReturnType<typeof useTaskStore>,
  currentViewRef: Ref<string>,
  options: { debounceMs?: number } = {},
) {
  const { debounceMs = 500 } = options;

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  const isConnected = ref(false);

  let activeTaskIds = new Set<string>();
  const pendingTaskIds = new Set<string>();

  /** 是否已调用 start()，用于区分主动停止与意外断开 */
  let isStarted = false;
  /** 最近一次收到 SSE 消息（含心跳）的时间戳，用于检测长时间无数据 */
  let lastMessageTime = 0;
  /** 不活跃检测定时器句柄（纯 setTimeout 自调度，确保任意时刻只有一个定时器） */
  let watchdogTimeout: ReturnType<typeof setTimeout> | null = null;
  /** 超过此时长（ms）未收到任何消息则触发重连 */
  const INACTIVITY_TIMEOUT_MS = 20_000;
  /** 检测间隔（ms） */
  const WATCHDOG_INTERVAL_MS = 10_000;

  const doBatchRefresh = async () => {
    const ids = Array.from(pendingTaskIds);
    pendingTaskIds.clear();

    if (ids.length === 0) return;

    try {
      const res = (await taskApi.getTasksByIds(ids)) as {
        data?: Array<Record<string, unknown> & { taskId?: string; id?: string }>;
      };
      const tasks = res?.data || [];

      tasks.forEach((task) => {
        const taskId = task.taskId || task.id;
        if (!taskId) return;
        taskStore.upsertTask(task);

        if (task.status === "pending" || task.status === "running") {
          activeTaskIds.add(taskId);
        } else {
          activeTaskIds.delete(taskId);
        }
      });
    } catch (e) {
      console.warn("[TaskSse] 批量刷新任务失败:", e);
    }
  };

  const unwatchView = watch(
    () => currentViewRef.value,
    (view) => {
      if (view === "tasks" && pendingTaskIds.size > 0) {
        doBatchRefresh();
      }
    },
  );

  const clearWatchdog = () => {
    if (watchdogTimeout) {
      clearTimeout(watchdogTimeout);
      watchdogTimeout = null;
    }
  };

  const {
    connect: startSse,
    close: stopSse,
    isConnecting,
  } = useSse({
    url: `${API_BASE}/logs/sse?search=[TASK_REFRESH]`,
    autoReconnect: false,
    onOpen: () => {
      lastMessageTime = Date.now();
      isConnected.value = true;
    },
    onMessage: (event) => {
      lastMessageTime = Date.now();
      try {
        const payload = JSON.parse(event.data);
        console.log({ payload });

        const rawLine = payload.rawLine || "";
        const match = rawLine.match(/\[TASK_REFRESH\]\s*taskId=([^\s]+)/);
        if (!match) return;

        try {
          const actionMatch = rawLine.match(/action=(\S+)/);
          const action = actionMatch ? actionMatch[1] : undefined;
          const str = "data={";
          const index = rawLine.indexOf(str);
          if (index !== -1) {
            const data = JSON.parse(rawLine.slice(index + str.length - 1));
            console.log({ data, action });
          }
        } catch { }

        const taskId = match[1];
        pendingTaskIds.add(taskId);

        if (debounceTimer) {
          clearTimeout(debounceTimer);
        }
        debounceTimer = setTimeout(() => {
          debounceTimer = null;
          doBatchRefresh();
        }, debounceMs);
      } catch {
        // 忽略解析失败的 SSE 消息
      }
    },
    onError: () => {
      isConnected.value = false;
    },
    onClose: () => {
      isConnected.value = false;
    },
  });

  // 自调度 watchdog：每次回调结束时重新挂载自身，保证任意时刻只有一个定时器
  const scheduleWatchdog = () => {
    clearWatchdog();
    if (!isStarted) return;
    watchdogTimeout = setTimeout(() => {
      watchdogTimeout = null;
      if (!isStarted) return;

      if (!isConnected.value && !isConnecting.value) {
        console.warn("[TaskSse] SSE 连接已断开，尝试重新连接...");
        lastMessageTime = Date.now();
        startSse();
      } else if (isConnected.value && Date.now() - lastMessageTime > INACTIVITY_TIMEOUT_MS) {
        console.warn("[TaskSse] 长时间未收到数据，重新连接...");
        stopSse();
        lastMessageTime = Date.now();
        startSse();
      }

      scheduleWatchdog();
    }, WATCHDOG_INTERVAL_MS);
  };

  const start = async () => {
    isStarted = true;
    lastMessageTime = Date.now();
    activeTaskIds = new Set(
      taskStore.tasks
        .filter((t) => t.status === "pending" || t.status === "running")
        .map((t) => t.id || t.taskId)
        .filter((id): id is string => Boolean(id)),
    );
    startSse();
    scheduleWatchdog();
  };

  const stop = () => {
    isStarted = false;
    unwatchView();
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    clearWatchdog();
    pendingTaskIds.clear();
    activeTaskIds.clear();
    stopSse();
    isConnected.value = false;
  };

  return {
    isConnected,
    start,
    stop,
  };
}

export default useTaskSseRefresh;
