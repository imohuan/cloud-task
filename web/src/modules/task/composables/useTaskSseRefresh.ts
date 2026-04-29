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

  const {
    connect: startSse,
    close: stopSse,
    isConnected: sseConnected,
  } = useSse({
    url: `${API_BASE}/logs/sse?search=[TASK_REFRESH]`,
    autoReconnect: false,
    onOpen: () => {
      isConnected.value = true;
    },
    onMessage: (event) => {
      try {
        const payload = JSON.parse(event.data);
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
        } catch {}

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

  const start = async () => {
    activeTaskIds = new Set(
      taskStore.tasks
        .filter((t) => t.status === "pending" || t.status === "running")
        .map((t) => t.id || t.taskId)
        .filter((id): id is string => Boolean(id)),
    );
    startSse();
  };

  const stop = () => {
    unwatchView();
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
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
