<template>
  <Transition name="fade-slide">
    <div v-if="taskId" class="fixed inset-0 z-50 flex flex-col bg-white">
      <header class="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-6">
        <div class="flex items-center gap-4">
          <button
            class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            @click="$emit('close')"
          >
            <ArrowBackFilled class="h-4 w-4" />
          </button>
          <div>
            <h3 class="font-bold text-slate-800">任务详情</h3>
            <p class="font-mono text-[10px] text-slate-400">{{ taskIdDisplay }}</p>
          </div>
          <span
            v-if="task"
            :class="getStatusBadgeClass(task.status)"
            class="rounded-lg px-3 py-0.5 text-[10px] font-bold uppercase"
          >
            <component :is="getStatusIcon(task.status)" class="mr-1 inline h-3 w-3" />
            {{ statusText }}
          </span>
        </div>
        <div ref="headerActionsTarget" class="flex items-center gap-2"></div>
      </header>

      <div class="relative flex-1 overflow-y-auto bg-slate-50/50 p-6">
        <div v-show="isMobile && task" class="mx-auto mb-4 max-w-5xl">
          <div class="form-card rounded-2xl px-4 py-3">
            <div class="section-header mb-3">
              <div class="section-icon">
                <SettingsFilled class="h-4 w-4" />
              </div>
              <h3 class="section-title">操作</h3>
            </div>
            <div ref="cardActionsTarget" class="flex items-center gap-2"></div>
          </div>
        </div>
        <div v-if="loading" class="absolute inset-0 z-30 flex items-center justify-center bg-white/90">
          <LoadingSpinner :size="32" :thickness="4" :text="task ? '刷新中...' : '加载中...'" />
        </div>
        <div v-if="task" class="mx-auto max-w-5xl space-y-6">
          <div class="form-card rounded-2xl p-6">
            <div class="section-header mb-4">
              <div class="section-icon">
                <TrendingUpFilled class="h-4 w-4" />
              </div>
              <h3 class="section-title">执行进度</h3>
              <span v-if="task" class="ml-auto font-mono text-2xl font-bold" :class="getProgressColor(task.status)"
                >{{ task.progress || 0 }}%</span
              >
            </div>
            <div class="h-3 overflow-hidden rounded-full bg-slate-100">
              <div
                class="h-full rounded-full transition-all duration-1000"
                :class="getProgressBarClass(task.status)"
                :style="{ width: (task.progress || 0) + '%' }"
              />
            </div>
            <div class="mt-3 flex justify-between text-[10px] text-slate-400">
              <span><ScheduleFilled class="mr-1 inline h-3 w-3" />创建: {{ formatDateTime(task.createdAt) }}</span>
              <span v-if="task.completedAt"
                ><CheckCircleFilled class="mr-1 inline h-3 w-3" />完成: {{ formatDateTime(task.completedAt) }}</span
              >
              <span v-else-if="task.status === 'running'" class="text-blue-500"
                ><RefreshFilled class="mr-1 inline h-3 w-3 animate-spin" />执行中...</span
              >
              <span v-else-if="task.status === 'pending'" class="text-amber-500"
                ><HourglassEmptyFilled class="mr-1 inline h-3 w-3" />等待中...</span
              >
            </div>
          </div>

          <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div class="space-y-6 lg:col-span-1">
              <div class="form-card rounded-2xl p-5">
                <div class="section-header mb-4">
                  <div class="section-icon">
                    <InfoFilled class="h-4 w-4" />
                  </div>
                  <h3 class="section-title">基本信息</h3>
                </div>
                <div class="space-y-3 text-xs">
                  <div class="form-field">
                    <div class="field-label">
                      <AppsFilled class="h-3 w-3" />
                      <span>所属接口</span>
                    </div>
                    <div class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-700">
                      {{ apiDisplayName }}
                    </div>
                  </div>
                  <div class="form-field">
                    <div class="field-label">
                      <NumbersFilled class="h-3 w-3" />
                      <span>任务ID</span>
                    </div>
                    <div
                      class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-[10px] break-all text-slate-600"
                    >
                      {{ task.id || task.taskId || "-" }}
                    </div>
                  </div>
                  <div class="form-field">
                    <div class="field-label">
                      <ScheduleFilled class="h-3 w-3" />
                      <span>耗时</span>
                    </div>
                    <div class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-700">
                      {{ duration }}
                    </div>
                  </div>
                  <div class="form-field">
                    <div class="field-label">
                      <ReplayFilled class="h-3 w-3" />
                      <span>重试策略</span>
                    </div>
                    <div class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-medium text-slate-700">
                      {{ task.retryPolicy || "指数退避 (Exponential Backoff)" }}
                    </div>
                  </div>
                </div>
              </div>

              <div class="form-card rounded-2xl p-5">
                <div class="section-header mb-4">
                  <div class="section-icon">
                    <TimelineFilled class="h-4 w-4" />
                  </div>
                  <h3 class="section-title">执行流程</h3>
                </div>
                <div class="space-y-0">
                  <div v-for="(step, idx) in workflowSteps" :key="step.key" class="flex gap-3">
                    <div class="flex flex-col items-center">
                      <div
                        class="flex h-6 w-6 items-center justify-center rounded-full text-[10px]"
                        :class="step.iconClass"
                      >
                        <component :is="step.icon" class="h-3 w-3" />
                      </div>
                      <div v-if="idx < workflowSteps.length - 1" class="mt-1 h-8 w-0.5" :class="step.lineClass" />
                    </div>
                    <div class="pb-4">
                      <p class="text-xs font-medium" :class="step.textClass">{{ step.label }}</p>
                      <p v-if="step.time" class="mt-0.5 text-[10px] text-slate-400">{{ step.time }}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="space-y-6 lg:col-span-2">
              <div class="form-card rounded-2xl p-5">
                <div class="section-header mb-4">
                  <div class="section-icon">
                    <InputFilled class="h-4 w-4" />
                  </div>
                  <h3 class="section-title">输入参数</h3>
                  <div class="ml-auto flex items-center gap-2">
                    <button
                      class="flex items-center gap-1 rounded px-2 py-1 text-[10px] text-slate-500 transition-colors hover:bg-slate-100 hover:text-indigo-600"
                      @click="expandInput(true)"
                    >
                      <OpenInFullFilled class="h-3 w-3" />展开
                    </button>
                    <button
                      class="flex items-center gap-1 rounded px-2 py-1 text-[10px] text-slate-500 transition-colors hover:bg-slate-100 hover:text-indigo-600"
                      @click="expandInput(false)"
                    >
                      <CloseFullscreenFilled class="h-3 w-3" />折叠
                    </button>
                    <button
                      class="flex items-center gap-1 rounded px-2 py-1 text-[10px] text-indigo-600 transition-colors hover:bg-indigo-50 hover:text-indigo-700"
                      @click="copyJson(task.input)"
                    >
                      <ContentCopyFilled class="h-3 w-3" />复制
                    </button>
                  </div>
                </div>
                <div class="max-h-80 overflow-auto rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <JsonViewer
                    :data="task.input || {}"
                    :is-last="true"
                    :is-root="true"
                    :expand-trigger="inputExpandState"
                  />
                </div>
              </div>

              <div
                v-if="task.output || task.status === 'failed'"
                class="form-card rounded-2xl p-5"
                :class="task.status === 'failed' ? 'border-red-200' : ''"
              >
                <div class="section-header mb-4">
                  <div class="section-icon" :class="task.status === 'failed' ? 'text-red-600' : 'text-emerald-600'">
                    <component
                      :is="task.status === 'failed' ? WarningAmberFilled : CheckCircleFilled"
                      class="h-4 w-4"
                    />
                  </div>
                  <h3 class="section-title">{{ task.status === "failed" ? "错误信息" : "输出结果" }}</h3>
                  <div class="ml-auto flex items-center gap-2">
                    <button
                      v-if="task.output"
                      class="flex items-center gap-1 rounded px-2 py-1 text-[10px] text-slate-500 transition-colors hover:bg-slate-100 hover:text-indigo-600"
                      @click="expandOutput(true)"
                    >
                      <OpenInFullFilled class="h-3 w-3" />展开
                    </button>
                    <button
                      v-if="task.output"
                      class="flex items-center gap-1 rounded px-2 py-1 text-[10px] text-slate-500 transition-colors hover:bg-slate-100 hover:text-indigo-600"
                      @click="expandOutput(false)"
                    >
                      <CloseFullscreenFilled class="h-3 w-3" />折叠
                    </button>
                    <button
                      v-if="task.output"
                      class="flex items-center gap-1 rounded px-2 py-1 text-[10px] text-indigo-600 transition-colors hover:bg-indigo-50 hover:text-indigo-700"
                      @click="copyJson(task.output)"
                    >
                      <ContentCopyFilled class="h-3 w-3" />复制
                    </button>
                    <button
                      v-if="task.status === 'failed' && !task.output && task.error"
                      class="flex items-center gap-1 rounded px-2 py-1 text-[10px] text-red-600 transition-colors hover:bg-red-50 hover:text-red-700"
                      @click="copyError(task.error)"
                    >
                      <ContentCopyFilled class="h-3 w-3" />复制
                    </button>
                  </div>
                </div>
                <div
                  v-if="task.status === 'failed' && !task.output"
                  class="rounded-xl border border-red-100 bg-red-50 p-4 space-y-2 select-text"
                >
                  <div v-if="task.error" class="space-y-2">
                    <div v-if="task.error.code" class="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold uppercase bg-red-100 text-red-700 border border-red-200">
                      {{ task.error.code }}
                    </div>
                    <p v-if="task.error.message" class="text-xs font-medium text-red-700">{{ task.error.message }}</p>
                    <pre v-if="task.error.details" class="font-mono text-[10px] text-red-500 whitespace-pre-wrap break-all">{{ task.error.details }}</pre>
                  </div>
                  <pre v-else class="font-mono text-[11px] text-red-600">任务执行失败，未返回详细信息</pre>
                </div>
                <div v-else class="max-h-80 overflow-auto rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <JsonViewer :data="task.output" :is-last="true" :is-root="true" :expand-trigger="outputExpandState" />
                </div>
              </div>

              <div
                v-else-if="task && task.status !== 'completed' && task.status !== 'failed'"
                class="form-card rounded-2xl p-10 text-center"
              >
                <div
                  class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-300"
                >
                  <HourglassEmptyFilled class="h-8 w-8" />
                </div>
                <h4 class="text-sm font-medium text-slate-600">等待执行完成</h4>
                <p class="mt-1 text-xs text-slate-400">任务执行完成后将在此显示结果</p>
              </div>

              <div class="form-card rounded-2xl p-5">
                <div class="section-header mb-4">
                  <div class="section-icon">
                    <TerminalFilled class="h-4 w-4" />
                  </div>
                  <h3 class="section-title">执行日志</h3>
                </div>
                <TerminalPanel
                  :search="task.id || task.taskId || ''"
                  :file="logFileName"
                  :load-history="true"
                  :sse-enabled="task.status !== 'completed' && task.status !== 'failed'"
                />
              </div>
            </div>
          </div>
        </div>
        <div v-else-if="error" class="mx-auto flex h-96 max-w-5xl items-center justify-center">
          <div class="text-center">
            <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-500">
              <ErrorFilled class="h-8 w-8" />
            </div>
            <h4 class="text-sm font-medium text-slate-600">加载失败</h4>
            <p class="mt-1 text-xs text-slate-400">{{ error }}</p>
            <button
              class="mt-4 rounded-lg bg-blue-500 px-4 py-2 text-xs text-white hover:bg-blue-600"
              @click="loadTaskDetail"
            >
              重试
            </button>
          </div>
        </div>
      </div>
      <Teleport v-if="teleportTarget" :to="(teleportTarget as HTMLElement)">
        <template v-if="task">
          <button
            :disabled="recreating"
            class="flex h-7 items-center gap-1.5 rounded-lg bg-blue-50 px-3 text-[11px] font-medium text-blue-600 transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
            title="使用相同配置重新创建任务"
            @click="recreateTask"
          >
            <ReplayFilled class="h-3 w-3" :class="{ 'animate-spin': recreating }" />
            重新执行
          </button>
          <button
            class="flex h-7 items-center gap-1.5 rounded-lg bg-slate-100 px-3 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-200"
            title="在表单中查看并编辑此配置"
            @click="openApiForm"
          >
            <OpenInNewFilled class="h-3 w-3" />
            查看配置
          </button>
        </template>
        <div class="mx-1 h-5 w-px bg-slate-200" />
        <button
          :disabled="loading"
          class="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
          title="刷新"
          @click="loadTaskDetail"
        >
          <RefreshFilled class="h-3 w-3" :class="{ 'animate-spin': loading }" />
        </button>
        <button
          class="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          title="复制任务ID"
          @click="copyTaskId"
        >
          <ContentCopyFilled class="h-3 w-3" />
        </button>
      </Teleport>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { storeToRefs } from "pinia";
import {
  ArrowBackFilled,
  ReplayFilled,
  OpenInNewFilled,
  RefreshFilled,
  ContentCopyFilled,
  TrendingUpFilled,
  ScheduleFilled,
  CheckCircleFilled,
  HourglassEmptyFilled,
  InfoFilled,
  AppsFilled,
  NumbersFilled,
  TimelineFilled,
  InputFilled,
  OpenInFullFilled,
  CloseFullscreenFilled,
  WarningAmberFilled,
  ErrorFilled,
  AddFilled,
  CheckFilled,
  CircleFilled,
  TerminalFilled,
  SettingsFilled,
} from "@vicons/material";
import type { Component } from "vue";
import { useTaskStore, useRegistryStore, useAppStore } from "@/stores";
import { logApi } from "@/api";
import JsonViewer from "@/components/JsonViewer.vue";
import LoadingSpinner from "@/components/LoadingSpinner.vue";
import TerminalPanel from "@/components/TerminalPanel.vue";

interface TaskItem {
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
  retryPolicy?: string;
  [key: string]: unknown;
}

const props = defineProps<{
  taskId?: string | null;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "recreateTask", data: { apiId?: string; authProfileId?: string; input?: unknown }): void;
  (e: "openApiForm", data: { apiId?: string; authProfileId?: string; input?: unknown }): void;
}>();

const appStore = useAppStore();
const { isMobile } = storeToRefs(appStore);
const headerActionsTarget = ref<HTMLElement | null>(null);
const cardActionsTarget = ref<HTMLElement | null>(null);
const teleportTarget = computed<HTMLElement | null>(() =>
  isMobile.value ? cardActionsTarget.value : headerActionsTarget.value,
);
const taskStore = useTaskStore();
const registryStore = useRegistryStore();
const task = ref<TaskItem | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const recreating = ref(false);
const inputExpandState = ref(1);
const outputExpandState = ref(1);
const logFileName = ref<string | undefined>();

const loadLogFile = async () => {
  if (!task.value?.createdAt) return;
  try {
    const res = (await logApi.getFiles()) as unknown as {
      success: boolean;
      data: { files: Array<{ name: string; modifiedAt: string }> };
    };
    if (!res.success || !res.data?.files?.length) return;

    const createdTime = new Date(task.value.createdAt).getTime();
    const completedTime = task.value.completedAt ? new Date(task.value.completedAt).getTime() : Date.now();

    const matched =
      res.data.files.find((f) => {
        const mtime = new Date(f.modifiedAt).getTime();
        return mtime >= createdTime && mtime <= completedTime;
      }) ||
      res.data.files.find((f) => {
        const mtime = new Date(f.modifiedAt).getTime();
        return mtime >= createdTime;
      }) ||
      res.data.files[0];

    logFileName.value = matched?.name;
  } catch {
    // 日志文件匹配失败静默处理
  }
};

const loadTaskDetail = async () => {
  if (!props.taskId) return;
  loading.value = true;
  error.value = null;
  try {
    const detail = await taskStore.fetchTaskDetail(props.taskId);
    task.value = (detail as TaskItem) || null;
    await loadLogFile();
  } catch (e) {
    console.error("获取任务详情失败:", e);
    error.value = (e as Error).message || "获取任务详情失败";
  } finally {
    loading.value = false;
  }
};

watch(
  () => props.taskId,
  (newId) => {
    if (newId) {
      task.value = null;
      loadTaskDetail();
    }
  },
  { immediate: true },
);

watch(
  () => taskStore.tasks.find((t) => (t.id || t.taskId) === props.taskId),
  (storeTask) => {
    if (storeTask && task.value) {
      task.value = { ...task.value, ...storeTask };
    }
  },
);

const apiDisplayName = computed(() => {
  if (!task.value) return "未命名任务";
  if (task.value.apiName) return task.value.apiName;
  const name = registryStore.getApiNameById(task.value.apiId || "");
  if (name) return name;
  return "未命名任务";
});

const taskIdDisplay = computed(() => {
  const id = props.taskId || "";
  return id.length > 20 ? id.substring(0, 12) + "..." : id;
});

const statusText = computed(() => {
  const map: Record<string, string> = {
    pending: "待处理",
    running: "执行中",
    completed: "已完成",
    failed: "失败",
  };
  return map[task.value?.status || ""] || task.value?.status || "未知";
});

const duration = computed(() => {
  const t = task.value;
  if (!t?.createdAt) return "-";
  const start = new Date(t.createdAt);
  const end = t.completedAt ? new Date(t.completedAt) : new Date();
  const diff = Math.floor((end.getTime() - start.getTime()) / 1000);

  if (diff < 60) return `${diff}秒`;
  if (diff < 3600) return `${Math.floor(diff / 60)}分${diff % 60}秒`;
  return `${Math.floor(diff / 3600)}时${Math.floor((diff % 3600) / 60)}分`;
});

const workflowSteps = computed(() => {
  const t = task.value;
  const status = t?.status;
  const createdAt = formatDateTime(t?.createdAt);
  const completedAt = formatDateTime(t?.completedAt);

  return [
    {
      key: "created",
      label: "任务创建",
      icon: AddFilled as Component,
      time: createdAt,
      iconClass: "bg-emerald-100 text-emerald-600",
      lineClass: status !== "pending" ? "bg-blue-500" : "bg-slate-200",
      textClass: "text-slate-700",
    },
    {
      key: "queued",
      label: "排队等待",
      icon: status === "pending" ? HourglassEmptyFilled : CheckFilled,
      time: status !== "pending" ? "已处理" : null,
      iconClass: status !== "pending" ? "bg-blue-100 text-blue-600" : "bg-slate-100 text-slate-400",
      lineClass: status === "running" || status === "completed" || status === "failed" ? "bg-blue-500" : "bg-slate-200",
      textClass: status !== "pending" ? "text-slate-700" : "text-slate-400",
    },
    {
      key: "running",
      label: "正在执行",
      icon:
        status === "running"
          ? RefreshFilled
          : status === "completed" || status === "failed"
            ? CheckFilled
            : CircleFilled,
      time: status === "running" ? "执行中..." : status === "completed" || status === "failed" ? "已执行" : null,
      iconClass:
        status === "running"
          ? "bg-blue-500 text-white"
          : status === "completed" || status === "failed"
            ? "bg-blue-100 text-blue-600"
            : "bg-slate-100 text-slate-300",
      lineClass:
        status === "completed" || status === "failed"
          ? status === "completed"
            ? "bg-emerald-500"
            : "bg-red-500"
          : "bg-slate-200",
      textClass:
        status === "running"
          ? "text-blue-600 font-medium"
          : status === "completed" || status === "failed"
            ? "text-slate-700"
            : "text-slate-400",
    },
    {
      key: "completed",
      label: status === "failed" ? "执行失败" : "执行完成",
      icon: status === "failed" ? ErrorFilled : CheckCircleFilled,
      time: status === "completed" || status === "failed" ? completedAt : null,
      iconClass:
        status === "failed"
          ? "bg-red-100 text-red-600"
          : status === "completed"
            ? "bg-emerald-100 text-emerald-600"
            : "bg-slate-100 text-slate-300",
      lineClass: "",
      textClass:
        status === "failed"
          ? "text-red-600 font-medium"
          : status === "completed"
            ? "text-emerald-600 font-medium"
            : "text-slate-400",
    },
  ];
});

const getStatusBadgeClass = (status?: string) => {
  if (status === "completed") return "bg-emerald-100 text-emerald-700 border border-emerald-200";
  if (status === "running") return "bg-blue-100 text-blue-700 border border-blue-200";
  if (status === "failed") return "bg-red-100 text-red-700 border border-red-200";
  return "bg-amber-100 text-amber-700 border border-amber-200";
};

const getStatusIcon = (status?: string): Component => {
  if (status === "completed") return CheckCircleFilled;
  if (status === "running") return RefreshFilled;
  if (status === "failed") return ErrorFilled;
  return HourglassEmptyFilled;
};

const getProgressColor = (status?: string) => {
  if (status === "completed") return "text-emerald-600";
  if (status === "failed") return "text-red-600";
  return "text-blue-600";
};

const getProgressBarClass = (status?: string) => {
  if (status === "completed") return "bg-emerald-500";
  if (status === "failed") return "bg-red-500";
  return "bg-blue-600";
};

const formatDateTime = (d?: string) => {
  if (!d) return "-";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "-";
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === "Escape" && props.taskId) {
    emit("close");
  }
};

onMounted(() => {
  window.addEventListener("keydown", handleKeydown);
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeydown);
});

const copyTaskId = () => {
  navigator.clipboard.writeText(props.taskId || "");
};

const copyJson = (data: unknown) => {
  navigator.clipboard.writeText(JSON.stringify(data, null, 2));
};

const copyError = (error: { code?: string; message?: string; details?: string } | null | undefined) => {
  if (!error) return;
  const parts: string[] = [];
  if (error.code) parts.push(`[${error.code}]`);
  if (error.message) parts.push(error.message);
  if (error.details) parts.push("", error.details);
  navigator.clipboard.writeText(parts.join("\n"));
};

const expandInput = (expand: boolean) => {
  inputExpandState.value = expand ? Math.abs(inputExpandState.value) + 1 : -(Math.abs(inputExpandState.value) + 1);
};

const expandOutput = (expand: boolean) => {
  outputExpandState.value = expand ? Math.abs(outputExpandState.value) + 1 : -(Math.abs(outputExpandState.value) + 1);
};

const recreateTask = async () => {
  if (!task.value) return;
  recreating.value = true;
  try {
    emit("recreateTask", {
      apiId: task.value.apiId,
      authProfileId: task.value.authProfileId,
      input: task.value.input,
    });
  } finally {
    recreating.value = false;
  }
};

const openApiForm = () => {
  if (!task.value) return;
  emit("openApiForm", {
    apiId: task.value.apiId,
    authProfileId: task.value.authProfileId,
    input: task.value.input,
  });
};
</script>
