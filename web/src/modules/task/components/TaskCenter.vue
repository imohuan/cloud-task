<template>
  <div class="mx-auto max-w-6xl space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl font-bold text-slate-800">任务中心</h2>
        <p class="mt-1 text-xs text-slate-500">管理并监控所有异步处理流水线</p>
      </div>
      <div class="flex gap-2">
        <button
          :disabled="tasksLoading"
          class="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          @click="$emit('refresh')"
        >
          <RefreshFilled class="mr-2 inline h-2.5 w-2.5" :class="{ 'animate-spin': tasksLoading }" />
          {{ tasksLoading ? "加载中..." : "刷新列表" }}
        </button>
      </div>
    </div>

    <div class="form-card rounded-2xl p-5">
      <div class="form-section">
        <div class="section-header">
          <div class="section-icon">
            <FilterListFilled class="h-4 w-4" />
          </div>
          <h3 class="section-title">筛选条件</h3>
        </div>

        <div class="grid grid-cols-1 gap-4 md:grid-cols-12">
          <div class="form-field md:col-span-5">
            <div class="field-label">
              <SearchFilled class="h-3 w-3" />
              <span>搜索</span>
            </div>
            <input v-model="searchQuery" type="text" placeholder="任务ID或API ID..." class="input-compact-sm" />
          </div>

          <div class="form-field md:col-span-2">
            <div class="field-label">
              <LabelFilled class="h-3 w-3" />
              <span>状态</span>
            </div>
            <Dropdown v-model:is-open="isStatusOpen" placement="bottom-start" :offset="4">
              <template #trigger>
                <button
                  class="input-compact-sm flex w-full items-center justify-between gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-[13px] text-gray-900"
                >
                  {{ statusOptions.find((o) => o.value === statusFilter)?.label || "全部" }}
                  <svg
                    class="h-3 w-3 text-slate-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </template>
              <template #default="{ close }">
                <div class="rounded-lg border border-gray-200 bg-white py-1 shadow-sm">
                  <button
                    v-for="opt in statusOptions"
                    :key="opt.value"
                    :class="opt.value === statusFilter ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'"
                    class="block w-full px-3 py-2 text-left text-[13px] whitespace-nowrap transition-colors"
                    @click="
                      statusFilter = opt.value;
                      close();
                    "
                  >
                    {{ opt.label }}
                  </button>
                </div>
              </template>
            </Dropdown>
          </div>

          <div class="form-field md:col-span-2">
            <div class="field-label">
              <CalendarTodayFilled class="h-3 w-3" />
              <span>开始日期</span>
            </div>
            <input v-model="startDate" type="date" class="input-compact-sm" />
          </div>

          <div class="form-field md:col-span-2">
            <div class="field-label">
              <EventAvailableFilled class="h-3 w-3" />
              <span>结束日期</span>
            </div>
            <input v-model="endDate" type="date" class="input-compact-sm" />
          </div>

          <div class="form-field flex flex-col justify-end md:col-span-1">
            <button
              v-if="hasFilters"
              class="flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-[7px] text-xs font-bold text-slate-600 transition-colors hover:bg-slate-50 hover:text-red-600"
              title="清除筛选"
              @click="clearFilters"
            >
              <CloseFilled class="h-2.5 w-2.5" />
            </button>
            <div v-else class="h-[34px]" />
          </div>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-4 gap-4">
      <div v-for="stat in taskStats" :key="stat.label" class="card-compact rounded-xl bg-white p-4">
        <p class="mb-1 text-[10px] font-bold tracking-wider text-slate-400 uppercase">{{ stat.label }}</p>
        <p class="text-xl font-bold" :class="stat.color">{{ stat.value }}</p>
      </div>
    </div>

    <div class="card-compact rounded-2xl bg-white">
      <div class="overflow-x-auto">
      <table class="w-full min-w-[640px] border-collapse text-left">
        <thead class="bg-slate-50/50 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
          <tr>
            <th class="border-b border-slate-100 px-6 py-4">任务 ID / 名称</th>
            <th class="border-b border-slate-100 px-6 py-4">状态</th>
            <th class="border-b border-slate-100 px-6 py-4">进度</th>
            <th class="border-b border-slate-100 px-6 py-4">创建时间</th>
            <th class="border-b border-slate-100 px-6 py-4 text-center">管理</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-50">
          <tr v-if="tasksLoading">
            <td colspan="5" class="py-20 text-center">
              <LoadingSpinner :size="48" :thickness="4" text="正在加载任务数据..." />
            </td>
          </tr>
          <tr
            v-for="task in filteredTasks"
            v-else-if="filteredTasks.length > 0"
            :key="task.id || task.taskId"
            class="group transition-colors hover:bg-slate-50/30"
          >
            <td class="px-6 py-4">
              <div class="flex flex-col">
                <span class="text-xs font-bold text-slate-700">{{ getTaskDisplayName(task) }}</span>
                <span class="font-mono text-[10px] text-slate-400">{{
                  (task.id || task.taskId || "-").substring(0, 12)
                }}</span>
              </div>
            </td>
            <td class="px-6 py-4">
              <span
                :class="getStatusBadgeClass(task.status)"
                class="rounded px-2 py-0.5 text-[9px] font-bold uppercase"
              >
                {{ task.status || "unknown" }}
              </span>
            </td>
            <td class="px-6 py-4">
              <div class="flex w-24 items-center gap-2">
                <div class="h-1 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    class="h-full bg-blue-500 transition-all duration-500"
                    :style="{ width: (task.progress || 0) + '%' }"
                  />
                </div>
                <span class="font-mono text-[10px] text-slate-400">{{ task.progress || 0 }}%</span>
              </div>
            </td>
            <td class="px-6 py-4 text-[11px] text-slate-500">
              {{ formatDate(task.createdAt) }}
            </td>
            <td class="px-6 py-4">
              <div class="flex items-center justify-center gap-1">
                <button
                  v-if="isActive(task.status)"
                  class="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                  title="取消任务"
                  @click="$emit('cancelTask', task)"
                >
                  <BlockFilled class="h-3 w-3" />
                </button>
                <button
                  class="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
                  title="重新执行"
                  @click="$emit('recreateTask', task)"
                >
                  <ReplayFilled class="h-3 w-3" />
                </button>
                <button
                  class="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-indigo-50 hover:text-indigo-600"
                  title="查看配置"
                  @click="$emit('openApiForm', task)"
                >
                  <OpenInNewFilled class="h-3 w-3" />
                </button>
                <button
                  class="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-emerald-50 hover:text-emerald-600"
                  title="详情"
                  @click="$emit('viewDetail', task.id || task.taskId || '')"
                >
                  <VisibilityFilled class="h-3 w-3" />
                </button>
              </div>
            </td>
          </tr>
          <tr v-else-if="filteredTasks.length === 0">
            <td colspan="5" class="py-20 text-center">
              <div class="flex flex-col items-center gap-3 text-slate-300">
                <InboxFilled class="mb-2 h-12 w-12 opacity-50" />
                <p class="text-sm font-medium">
                  {{ (tasks?.length ?? 0) === 0 ? "暂无任务记录" : "没有找到匹配的任务" }}
                </p>
                <p v-if="(tasks?.length ?? 0) === 0" class="text-xs text-slate-400">创建异步任务后将在此显示</p>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      </div>

      <div
        v-if="pagination && pagination.total > 0"
        class="flex items-center justify-between border-t border-slate-100 px-6 py-4"
      >
        <div class="flex items-center gap-3 text-xs text-slate-500">
          <span>共 {{ pagination.total }} 条</span>
          <Dropdown v-model:is-open="isPageSizeOpen" placement="bottom-start" :offset="4">
            <template #trigger>
              <button
                class="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
              >
                {{ pagination.pageSize }} 条/页
                <svg
                  class="h-3 w-3 text-slate-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </template>
            <template #default="{ close }">
              <div class="rounded-lg border border-gray-200 bg-white py-1 shadow-sm">
                <button
                  v-for="opt in pageSizeOptions"
                  :key="opt.value"
                  :class="
                    opt.value === pagination.pageSize ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-50'
                  "
                  class="block w-full px-3 py-2 text-left text-[13px] whitespace-nowrap transition-colors"
                  @click="
                    changePageSize(opt.value);
                    close();
                  "
                >
                  {{ opt.label }}
                </button>
              </div>
            </template>
          </Dropdown>
        </div>
        <div class="flex items-center gap-1.5">
          <button
            :disabled="pagination.page <= 1"
            class="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            @click="goToPage(pagination.page - 1)"
          >
            上一页
          </button>
          <button
            v-for="p in visiblePages"
            :key="p"
            :class="
              p === pagination.page
                ? 'border-blue-500 bg-blue-500 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            "
            class="h-7 min-w-[28px] rounded-md border px-1.5 text-xs font-medium transition-colors"
            @click="goToPage(p)"
          >
            {{ p }}
          </button>
          <button
            :disabled="pagination.page >= pagination.totalPages"
            class="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            @click="goToPage(pagination.page + 1)"
          >
            下一页
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import {
  RefreshFilled,
  FilterListFilled,
  SearchFilled,
  LabelFilled,
  CalendarTodayFilled,
  EventAvailableFilled,
  CloseFilled,
  ReplayFilled,
  OpenInNewFilled,
  VisibilityFilled,
  InboxFilled,
  BlockFilled,
} from "@vicons/material";
import { useRegistryStore } from "@/stores";
import Dropdown from "@/components/dropdown/Dropdown.vue";
import LoadingSpinner from "@/components/LoadingSpinner.vue";

interface TaskItem {
  id?: string;
  taskId?: string;
  apiId?: string;
  apiName?: string;
  status?: string;
  progress?: number;
  createdAt?: string;
  [key: string]: unknown;
}

const props = defineProps<{
  tasks?: TaskItem[];
  taskStats?: { label: string; value: number; color: string }[];
  tasksLoading?: boolean;
  pagination?: { total: number; page: number; pageSize: number; totalPages: number };
}>();

const emit = defineEmits<{
  (e: "refresh"): void;
  (e: "viewDetail", taskId: string): void;
  (e: "recreateTask", task: TaskItem): void;
  (e: "openApiForm", task: TaskItem): void;
  (e: "cancelTask", task: TaskItem): void;
  (e: "update:page", page: number): void;
  (e: "update:pageSize", pageSize: number): void;
  (e: "filterChange", filters: { search: string; status: string; startDate: string; endDate: string }): void;
}>();

const registryStore = useRegistryStore();

const searchQuery = ref("");
const statusFilter = ref("");
const startDate = ref("");
const endDate = ref("");
const isStatusOpen = ref(false);
const isPageSizeOpen = ref(false);

const statusOptions = [
  { label: "全部状态", value: "" },
  { label: "待处理", value: "pending" },
  { label: "执行中", value: "running" },
  { label: "已完成", value: "completed" },
  { label: "失败", value: "failed" },
];

const pageSizeOptions = [
  { label: "10 条/页", value: 10 },
  { label: "20 条/页", value: 20 },
  { label: "50 条/页", value: 50 },
];

const hasFilters = computed(() => searchQuery.value || statusFilter.value || startDate.value || endDate.value);

const getTaskDisplayName = (task: TaskItem) => {
  if (task.apiName) return task.apiName;
  const name = registryStore.getApiNameById(task.apiId || "");
  if (name) return name;
  return "未命名任务";
};

const filteredTasks = computed(() => props.tasks || []);

let filterTimer: ReturnType<typeof setTimeout> | null = null;
watch([searchQuery, statusFilter, startDate, endDate], () => {
  if (filterTimer) clearTimeout(filterTimer);
  filterTimer = setTimeout(() => {
    emit("filterChange", {
      search: searchQuery.value,
      status: statusFilter.value,
      startDate: startDate.value,
      endDate: endDate.value,
    });
  }, 300);
});

const visiblePages = computed(() => {
  const total = props.pagination?.totalPages ?? 1;
  const current = props.pagination?.page ?? 1;
  const pages: number[] = [];
  const maxVisible = 5;
  let start = Math.max(1, current - Math.floor(maxVisible / 2));
  let end = Math.min(total, start + maxVisible - 1);
  if (end - start + 1 < maxVisible) {
    start = Math.max(1, end - maxVisible + 1);
  }
  for (let i = start; i <= end; i++) pages.push(i);
  return pages;
});

const goToPage = (page: number) => {
  if (!props.pagination || page < 1 || page > props.pagination.totalPages) return;
  emit("update:page", page);
};

const changePageSize = (value: string | number) => {
  const size = typeof value === "string" ? parseInt(value, 10) : value;
  emit("update:pageSize", size);
};

const clearFilters = () => {
  searchQuery.value = "";
  statusFilter.value = "";
  startDate.value = "";
  endDate.value = "";
};

const ACTIVE_STATUSES = new Set(['pending', 'running', 'polling', 'polling-run']);
const isActive = (status?: string) => ACTIVE_STATUSES.has(status || '');

const getStatusBadgeClass = (status?: string) => {
  if (status === "completed") return "bg-emerald-100 text-emerald-700";
  if (status === "running") return "bg-blue-100 text-blue-700";
  if (status === "failed") return "bg-red-100 text-red-700";
  return "bg-slate-100 text-slate-500";
};

const formatDate = (d?: string) => {
  if (!d) return "-";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "-";
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};
</script>
