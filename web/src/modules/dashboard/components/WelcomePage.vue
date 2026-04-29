<template>
  <div class="mx-auto max-w-4xl py-10">
    <div class="mb-12 text-center">
      <h1 class="mb-2 text-2xl font-bold text-slate-800">欢迎使用 Cloud Task</h1>
      <p class="text-sm text-slate-500">选择左侧 API 资源库中的接口开始您的云端任务调度。</p>
    </div>
    <div class="grid grid-cols-1 gap-6 md:grid-cols-3">
      <div
        class="card-compact cursor-pointer rounded-2xl bg-white p-6 transition-all hover:border-blue-200"
        @click="$emit('navigate', 'tasks')"
      >
        <div class="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-lg text-blue-600">
          <TrendingUpFilled class="h-6 w-6" />
        </div>
        <h3 class="mb-1 font-bold text-slate-800">活跃任务</h3>
        <p class="text-xs text-slate-400">当前共有 {{ activeTasksCount }} 个任务正在执行中。</p>
      </div>

      <div class="card-compact cursor-pointer rounded-2xl bg-white p-6 transition-all hover:border-blue-200">
        <div class="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-lg text-emerald-600">
          <PowerFilled class="h-6 w-6" />
        </div>
        <h3 class="mb-1 font-bold text-slate-800">API 接入</h3>
        <p class="text-xs text-slate-400">配置认证信息后即可调用云端 API 服务。</p>
      </div>

      <div class="card-compact cursor-pointer rounded-2xl bg-white p-6 transition-all hover:border-blue-200">
        <div class="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-lg text-amber-600">
          <MenuBookFilled class="h-6 w-6" />
        </div>
        <h3 class="mb-1 font-bold text-slate-800">使用文档</h3>
        <p class="text-xs text-slate-400">查看详细的使用指南和 API 文档说明。</p>
      </div>

      <div
        class="card-compact cursor-pointer rounded-2xl bg-white p-6 transition-all hover:border-blue-200"
        @click="toggleSSE"
      >
        <div class="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-lg text-purple-600">
          <TerminalFilled class="h-6 w-6" />
        </div>
        <h3 class="mb-1 font-bold text-slate-800">实时日志</h3>
        <p class="text-xs text-slate-400">
          {{ sseConnected ? "监听中... 点击停止" : "点击启动 SSE 日志监听（测试）" }}
        </p>
        <span
          v-if="sseConnected"
          class="mt-2 inline-block rounded bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700"
          >已连接</span
        >
        <span
          v-if="sseError"
          class="mt-2 inline-block rounded bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700"
          >{{ sseError }}</span
        >
      </div>

      <div
        class="card-compact cursor-pointer rounded-2xl bg-white p-6 transition-all hover:border-blue-200"
        @click="previewTaskItem"
      >
        <div class="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-lg text-rose-600">
          <LayersFilled class="h-6 w-6" />
        </div>
        <h3 class="mb-1 font-bold text-slate-800">任务项组件</h3>
        <p class="text-xs text-slate-400">{{ showTaskDemo ? "点击收起预览" : "点击预览资源任务列表项组件" }}</p>
      </div>
    </div>

    <TaskItemDemo v-if="showTaskDemo" class="mt-6" />

    <div v-if="sseLogs.length > 0" class="mt-6 overflow-hidden rounded-2xl bg-slate-900 p-4">
      <div class="mb-3 flex items-center justify-between">
        <h4 class="text-xs font-bold tracking-wider text-slate-400 uppercase">SSE 日志实时流</h4>
        <span class="text-[10px] text-slate-500">共 {{ sseLogs.length }} 条（保留最近 50 条）</span>
      </div>
      <div class="max-h-64 space-y-1 overflow-y-auto font-mono text-[11px] leading-5">
        <div
          v-for="(line, idx) in sseLogs"
          :key="idx"
          class="border-b border-slate-800 pb-1 text-slate-300 last:border-0"
        >
          {{ line }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onBeforeUnmount } from "vue";
import { TrendingUpFilled, PowerFilled, MenuBookFilled, TerminalFilled, LayersFilled } from "@vicons/material";
import { API_BASE } from "@/api";
import { useSse } from "@/composables/useSse";
import TaskItemDemo from "./TaskItemDemo.vue";

defineProps<{
  activeTasksCount?: number;
}>();

defineEmits<{
  (e: "navigate", view: string): void;
}>();

const sseLogs = ref<string[]>([]);
const sseError = ref<string | null>(null);
const showTaskDemo = ref(false);

const {
  isConnected: sseConnected,
  isConnecting,
  close: disconnectSSE,
  connect: connectSSE,
} = useSse({
  url: `${API_BASE}/logs/sse`,
  autoReconnect: false,
  onMessage: (event) => {
    try {
      const data = JSON.parse(event.data);
      const line = data.rawLine || JSON.stringify(data);
      sseLogs.value.push(line);
      if (sseLogs.value.length > 50) {
        sseLogs.value.shift();
      }
    } catch {
      sseLogs.value.push(event.data);
    }
  },
  onError: () => {
    sseError.value = "SSE 连接错误";
  },
  onOpen: () => {
    sseError.value = null;
  },
  onClose: () => {
    sseError.value = null;
  },
});

const toggleSSE = () => {
  if (sseConnected.value || isConnecting.value) {
    disconnectSSE();
  } else {
    sseError.value = null;
    connectSSE();
  }
};

const previewTaskItem = () => {
  showTaskDemo.value = !showTaskDemo.value;
};

onBeforeUnmount(() => {
  disconnectSSE();
});
</script>
