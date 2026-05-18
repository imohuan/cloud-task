import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { taskApi } from "@/api";
import { useLoading } from "@/composables/useLoading";

export interface TaskItem {
  id?: string;
  taskId?: string;
  apiId?: string;
  apiName?: string;
  authProfileId?: string;
  status?: string;
  progress?: number;
  createdAt?: string;
  completedAt?: string;
  input?: unknown;
  output?: unknown;
  error?: { code?: string; message?: string; details?: string } | null;
  [key: string]: unknown;
}

export const useTaskStore = defineStore("task", () => {
  const tasks = ref<TaskItem[]>([]);
  const hasFetched = ref(false);
  const loader = useLoading();

  const pagination = ref({ total: 0, page: 1, pageSize: 20, totalPages: 0 });
  const filters = ref<{
    status: string;
    search: string;
    startDate: string;
    endDate: string;
  }>({ status: "", search: "", startDate: "", endDate: "" });

  const stats = ref({
    total: 0,
    pending: 0,
    running: 0,
    completed: 0,
    failed: 0,
    polling: 0,
    "polling-run": 0,
    timeout: 0,
  });

  const activeTasksCount = computed(() => stats.value.running + stats.value["polling-run"]);

  const taskStats = computed(() => [
    {
      label: "活跃运行",
      value: stats.value.running,
      color: "text-blue-600",
    },
    {
      label: "已完成",
      value: stats.value.completed,
      color: "text-emerald-600",
    },
    {
      label: "异常终止",
      value: stats.value.failed,
      color: "text-red-600",
    },
    {
      label: "排队等待",
      value: stats.value.pending,
      color: "text-amber-600",
    },
  ]);

  async function fetchTaskStats() {
    try {
      const res = (await taskApi.getTaskStats()) as { data?: Partial<typeof stats.value> };
      if (res?.data) {
        stats.value = { ...stats.value, ...res.data };
      }
    } catch (e) {
      console.warn("获取任务统计失败:", e);
    }
  }

  async function fetchTasks(page = pagination.value.page, pageSize = pagination.value.pageSize) {
    await loader.withLoading(async () => {
      const params = {
        page,
        pageSize,
        ...(filters.value.status ? { status: filters.value.status } : {}),
        ...(filters.value.search ? { search: filters.value.search } : {}),
        ...(filters.value.startDate ? { startDate: filters.value.startDate } : {}),
        ...(filters.value.endDate ? { endDate: filters.value.endDate } : {}),
      };
      const res = (await taskApi.getTasks(params)) as {
        data?: { list?: TaskItem[]; pagination?: typeof pagination.value };
      };
      const data = res?.data;
      tasks.value = data?.list || [];
      pagination.value = data?.pagination || { total: 0, page: 1, pageSize: 20, totalPages: 0 };
      hasFetched.value = true;
      await fetchTaskStats();
    });
  }

  async function silentFetchTasks(page = pagination.value.page, pageSize = pagination.value.pageSize) {
    try {
      const params = {
        page,
        pageSize,
        ...(filters.value.status ? { status: filters.value.status } : {}),
        ...(filters.value.search ? { search: filters.value.search } : {}),
        ...(filters.value.startDate ? { startDate: filters.value.startDate } : {}),
        ...(filters.value.endDate ? { endDate: filters.value.endDate } : {}),
      };
      const res = (await taskApi.getTasks(params)) as {
        data?: { list?: TaskItem[]; pagination?: typeof pagination.value };
      };
      const data = res?.data;
      const newList: TaskItem[] = data?.list || [];
      pagination.value = data?.pagination || { total: 0, page: 1, pageSize: 20, totalPages: 0 };

      const newMap = new Map(newList.map((t) => [t.id || t.taskId, t]));

      for (const existing of tasks.value) {
        const id = existing.id || existing.taskId;
        if (id && newMap.has(id)) {
          Object.assign(existing, newMap.get(id)!);
        }
      }

      for (let i = tasks.value.length - 1; i >= 0; i--) {
        const item = tasks.value[i];
        if (!item) continue;
        const id = item.id || item.taskId;
        if (id && !newMap.has(id)) {
          tasks.value.splice(i, 1);
        }
      }

      const existingIds = new Set(tasks.value.map((t) => t.id || t.taskId));
      for (const newTask of newList) {
        const id = newTask.id || newTask.taskId;
        if (id && !existingIds.has(id)) {
          tasks.value.unshift(newTask);
        }
      }
    } catch (e) {
      console.warn("任务列表无感刷新失败:", e);
    }
  }

  async function fetchMoreTasks() {
    const hasMore = pagination.value.page < pagination.value.totalPages;
    if (!hasMore) return false;

    const nextPage = pagination.value.page + 1;
    const params = {
      page: nextPage,
      pageSize: pagination.value.pageSize,
      ...(filters.value.status ? { status: filters.value.status } : {}),
      ...(filters.value.search ? { search: filters.value.search } : {}),
      ...(filters.value.startDate ? { startDate: filters.value.startDate } : {}),
      ...(filters.value.endDate ? { endDate: filters.value.endDate } : {}),
    };

    const res = (await taskApi.getTasks(params)) as {
      data?: { list?: TaskItem[]; pagination?: typeof pagination.value };
    };
    const list = res?.data?.list || [];

    const existingIds = new Set(tasks.value.map((t) => t.id || t.taskId));
    const appendList = list.filter((t) => {
      const id = t.id || t.taskId;
      return !!id && !existingIds.has(id);
    });

    if (appendList.length) {
      tasks.value.push(...appendList);
    }

    pagination.value = res?.data?.pagination || pagination.value;
    return appendList.length > 0;
  }

  function upsertTask(task: TaskItem) {
    const taskId = task.id || task.taskId;
    if (!taskId) return;
    const idx = tasks.value.findIndex((t) => (t.id || t.taskId) === taskId);
    if (idx !== -1) {
      Object.assign(tasks.value[idx]!, task);
    } else {
      tasks.value.unshift(task);
    }
  }

  async function fetchTaskDetail(taskId: string) {
    return await loader.withLoading(async () => {
      const res = (await taskApi.getTask(taskId)) as { data?: TaskItem };
      return res?.data ?? res;
    });
  }

  async function cancelTask(taskId: string) {
    const res = (await taskApi.cancelTask(taskId)) as { success?: boolean };
    if (res?.success) {
      const task = tasks.value.find((t) => (t.id || t.taskId) === taskId);
      if (task) {
        task.status = 'failed';
      }
    }
    return res;
  }

  async function deleteTask(taskId: string) {
    const res = (await taskApi.deleteTask(taskId)) as { success?: boolean };
    if (res?.success) {
      const tid = taskId;
      tasks.value = tasks.value.filter((t) => (t.id || t.taskId) !== tid);
    }
    return res;
  }

  async function batchDeleteTasks(ids: string[]) {
    const res = (await taskApi.batchDeleteTasks(ids)) as { success?: boolean; data?: { deletedCount?: number } };
    if (res?.success) {
      const idSet = new Set(ids);
      tasks.value = tasks.value.filter((t) => !idSet.has(t.id || t.taskId || ""));
    }
    return res;
  }

  return {
    tasks,
    hasFetched,
    loading: loader.loading,
    activeTasksCount,
    taskStats,
    pagination,
    filters,
    fetchTasks,
    fetchMoreTasks,
    silentFetchTasks,
    upsertTask,
    fetchTaskDetail,
    cancelTask,
    deleteTask,
    batchDeleteTasks,
  };
});
