<template>
  <TestLayout title="SSE 实时日志" description="测试 SSE 连接与实时日志流推送" badge="网络" badge-color="purple">
    <!-- SSE 实时流 -->
    <TestCard title="过滤配置" subtitle="输入关键词过滤日志，留空则监听全部">
      <div class="flex items-center gap-3">
        <input
          v-model="searchInput"
          class="input-compact flex-1"
          placeholder="过滤关键词（如 ERROR、task、api 等）"
          @keydown.enter="handleConnect"
        />
        <button
          v-if="!activeSearch"
          class="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-slate-700"
          @click="handleConnect"
        >
          连接
        </button>
        <button
          v-else
          class="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs font-medium text-red-600 transition-colors hover:bg-red-100"
          @click="handleDisconnect"
        >
          断开
        </button>
      </div>
    </TestCard>

    <TestCard title="日志流" subtitle="xterm 终端渲染，支持 ANSI 颜色">
      <TerminalPanel :search="activeSearch" :height="420" :sse-enabled="true" />
    </TestCard>

    <!-- 时间范围日志查询 -->
    <TestCard title="时间范围查询" subtitle="按任务时间段跨文件检索日志，模拟 TaskDetail 场景">
      <div class="space-y-3">
        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1">
            <label class="text-[10px] font-semibold tracking-widest text-slate-400 uppercase">开始时间</label>
            <input
              v-model="timeStartInput"
              type="datetime-local"
              class="input-compact w-full"
            />
          </div>
          <div class="space-y-1">
            <label class="text-[10px] font-semibold tracking-widest text-slate-400 uppercase">结束时间（可选）</label>
            <input
              v-model="timeEndInput"
              type="datetime-local"
              class="input-compact w-full"
            />
          </div>
        </div>
        <div class="flex items-center gap-3">
          <input
            v-model="timeSearchInput"
            class="input-compact flex-1"
            placeholder="关键词过滤（可选）"
          />
          <div class="flex items-center gap-1.5">
            <label class="text-[10px] font-semibold text-slate-400 whitespace-nowrap">偏移(分钟)</label>
            <input
              v-model.number="offsetMinutes"
              type="number"
              min="0"
              class="input-compact w-16 text-center"
            />
          </div>
          <button
            class="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            :disabled="!timeStartInput || isTimeLoading"
            @click="handleTimeFetch"
          >
            {{ isTimeLoading ? "加载中…" : "查询" }}
          </button>
        </div>

        <!-- 结果信息条 -->
        <div v-if="timeResult !== null" class="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-500">
          <span>共 <strong class="text-slate-700">{{ timeLines.length }}</strong> 行</span>
          <span v-if="timeStartInput" class="text-slate-300">|</span>
          <span v-if="timeStartInput">
            {{ new Date(timeStartInput).toLocaleString() }}
            <template v-if="timeEndInput"> — {{ new Date(timeEndInput).toLocaleString() }}</template>
            <template v-else> — 至今</template>
          </span>
          <span class="text-slate-300">|</span>
          <span>前置偏移 {{ offsetMinutes }} 分钟</span>
        </div>
      </div>
    </TestCard>

    <TestCard v-if="timeResult !== null" title="时间范围日志" subtitle="跨多个日志文件合并结果">
      <TerminalPanel
        :search="activeTimeSearch"
        :start-time="activeStartMs"
        :end-time="activeEndMs"
        :load-history="true"
        :sse-enabled="false"
        :height="420"
      />
    </TestCard>
  </TestLayout>
</template>

<script setup lang="ts">
import { ref } from "vue";
import TestLayout from "@/modules/test/components/TestLayout.vue";
import TestCard from "@/modules/test/components/TestCard.vue";
import TerminalPanel from "@/components/TerminalPanel.vue";
import { useLogByTime } from "@/composables/useLogByTime";

// ---- SSE 实时流 ----
const searchInput = ref("");
const activeSearch = ref("");

const handleConnect = () => {
  activeSearch.value = searchInput.value.trim() || " ";
};

const handleDisconnect = () => {
  activeSearch.value = "";
};

// ---- 时间范围查询 ----
const timeStartInput = ref("");
const timeEndInput = ref("");
const timeSearchInput = ref("");
const offsetMinutes = ref(10);
const timeResult = ref<null | true>(null);

const activeStartMs = ref<number | undefined>();
const activeEndMs = ref<number | undefined>();
const activeTimeSearch = ref("");

const { lines: timeLines, isLoading: isTimeLoading, loadByTime } = useLogByTime();

const handleTimeFetch = async () => {
  if (!timeStartInput.value) return;
  const startMs = new Date(timeStartInput.value).getTime();
  const endMs = timeEndInput.value ? new Date(timeEndInput.value).getTime() : undefined;

  activeStartMs.value = startMs;
  activeEndMs.value = endMs;
  activeTimeSearch.value = timeSearchInput.value.trim() || " ";
  timeResult.value = true;

  await loadByTime({
    startTime: startMs,
    endTime: endMs,
    offsetMinutes: offsetMinutes.value,
    search: timeSearchInput.value.trim() || undefined,
  });
};
</script>
