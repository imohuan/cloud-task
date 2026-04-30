<template>
  <div class="mx-auto max-w-5xl py-10">
    <!-- ═══════════════ 数据看板 ═══════════════ -->
    <section class="mb-12">
      <div class="mb-4 flex items-center justify-between">
        <h2 class="text-base font-bold text-slate-800">数据看板</h2>
        <button
          class="rounded-lg px-3 py-1.5 text-xs text-slate-500 transition-colors hover:bg-slate-100 disabled:opacity-40"
          :disabled="isLoadingDashboard"
          @click="loadDashboard"
        >
          <span :class="isLoadingDashboard ? 'inline-block animate-spin' : ''">↻</span>
          刷新
        </button>
      </div>

      <!-- KPI Cards -->
      <div class="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div class="card-compact rounded-2xl p-4">
          <p class="mb-1 text-[11px] text-slate-400">总任务数</p>
          <p class="text-2xl font-bold text-slate-800">{{ stats.total }}</p>
          <p class="mt-1 text-[10px] text-slate-400">重试 {{ analytics.totalRetries }} 次</p>
        </div>
        <div class="card-compact rounded-2xl p-4">
          <p class="mb-1 text-[11px] text-slate-400">成功率</p>
          <p class="text-2xl font-bold text-emerald-600">{{ successRate }}%</p>
          <p class="mt-1 text-[10px] text-slate-400">{{ stats.completed }} 已完成</p>
        </div>
        <div class="card-compact rounded-2xl p-4">
          <p class="mb-1 text-[11px] text-slate-400">失败数</p>
          <p class="text-2xl font-bold text-red-500">{{ stats.failed }}</p>
          <p class="mt-1 text-[10px] text-slate-400">超时 {{ stats.timeout }}</p>
        </div>
        <div class="card-compact rounded-2xl p-4">
          <p class="mb-1 text-[11px] text-slate-400">活跃中</p>
          <p class="text-2xl font-bold text-blue-600">{{ activeCount }}</p>
          <p class="mt-1 text-[10px] text-slate-400">等待 {{ stats.pending }}</p>
        </div>
        <div class="card-compact rounded-2xl p-4">
          <p class="mb-1 text-[11px] text-slate-400">平均耗时</p>
          <p class="text-2xl font-bold text-slate-700">{{ avgDurationText }}</p>
          <p class="mt-1 text-[10px] text-slate-400">已完成任务</p>
        </div>
      </div>

      <!-- Charts Row -->
      <div class="mb-4 grid grid-cols-1 gap-4 md:grid-cols-5">
        <!-- Status Donut Chart -->
        <div class="card-compact rounded-2xl p-5 md:col-span-2">
          <p class="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">状态分布</p>
          <div class="flex items-center gap-4">
            <svg viewBox="0 0 140 140" class="h-28 w-28 shrink-0">
              <g transform="rotate(-90, 70, 70)">
                <circle
                  v-if="stats.total === 0"
                  cx="70"
                  cy="70"
                  :r="DONUT_R"
                  fill="none"
                  stroke="#e2e8f0"
                  stroke-width="22"
                />
                <circle
                  v-for="seg in donutSegments.filter((s) => s.count > 0)"
                  :key="seg.status"
                  cx="70"
                  cy="70"
                  :r="DONUT_R"
                  fill="none"
                  :stroke="seg.color"
                  stroke-width="22"
                  :stroke-dasharray="`${seg.dash} ${donutCircumference}`"
                  :stroke-dashoffset="-seg.offset"
                />
              </g>
              <text x="70" y="67" text-anchor="middle" fill="#1e293b" font-size="20" font-weight="700">
                {{ stats.total }}
              </text>
              <text x="70" y="81" text-anchor="middle" fill="#94a3b8" font-size="9">总计</text>
            </svg>
            <ul class="flex-1 space-y-1.5">
              <li
                v-for="seg in donutSegments.filter((s) => s.count > 0)"
                :key="seg.status"
                class="flex items-center justify-between gap-2 text-[11px]"
              >
                <div class="flex min-w-0 items-center gap-1.5">
                  <span class="h-2 w-2 shrink-0 rounded-full" :style="{ backgroundColor: seg.color }"></span>
                  <span class="truncate text-slate-500">{{ STATUS_LABELS[seg.status] }}</span>
                </div>
                <span class="shrink-0 font-semibold text-slate-700">{{ seg.count }}</span>
              </li>
              <li v-if="stats.total === 0" class="text-[11px] text-slate-300">暂无数据</li>
            </ul>
          </div>
        </div>

        <!-- Trend Line Chart -->
        <div class="card-compact rounded-2xl p-5 md:col-span-3">
          <p class="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">近 14 天趋势</p>
          <div v-if="trendData">
            <svg viewBox="0 0 400 120" class="w-full">
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.2" />
                  <stop offset="100%" stop-color="#3b82f6" stop-opacity="0" />
                </linearGradient>
              </defs>
              <line x1="10" y1="5" x2="390" y2="5" stroke="#f1f5f9" stroke-width="1" />
              <line x1="10" y1="36" x2="390" y2="36" stroke="#f1f5f9" stroke-width="1" />
              <line x1="10" y1="67" x2="390" y2="67" stroke="#f1f5f9" stroke-width="1" />
              <line x1="10" y1="98" x2="390" y2="98" stroke="#f1f5f9" stroke-width="1" />
              <polygon :points="trendData.areaPoints" fill="url(#areaGrad)" />
              <polyline
                :points="trendData.totalPoints"
                fill="none"
                stroke="#3b82f6"
                stroke-width="2"
                stroke-linejoin="round"
                stroke-linecap="round"
              />
              <polyline
                :points="trendData.completedPoints"
                fill="none"
                stroke="#10b981"
                stroke-width="1.5"
                stroke-linejoin="round"
                stroke-linecap="round"
                stroke-dasharray="4 2"
              />
              <polyline
                :points="trendData.failedPoints"
                fill="none"
                stroke="#ef4444"
                stroke-width="1.5"
                stroke-linejoin="round"
                stroke-linecap="round"
              />
              <text :x="trendData.xPoints[0]" y="116" text-anchor="middle" fill="#cbd5e1" font-size="8">
                {{ fmtDate(trendData.trend[0]?.date ?? '') }}
              </text>
              <text
                v-if="trendData.trend.length > 2"
                :x="trendData.xPoints[Math.floor((trendData.trend.length - 1) / 2)]"
                y="116"
                text-anchor="middle"
                fill="#cbd5e1"
                font-size="8"
              >
                {{ fmtDate(trendData.trend[Math.floor((trendData.trend.length - 1) / 2)]?.date ?? '') }}
              </text>
              <text :x="trendData.xPoints[trendData.xPoints.length - 1]" y="116" text-anchor="middle" fill="#cbd5e1" font-size="8">
                {{ fmtDate(trendData.trend[trendData.trend.length - 1]?.date ?? '') }}
              </text>
            </svg>
            <div class="mt-2 flex gap-4 text-[10px] text-slate-400">
              <span class="flex items-center gap-1"><span class="inline-block h-px w-4 bg-blue-500"></span>总计</span>
              <span class="flex items-center gap-1"><span class="inline-block h-px w-4 bg-emerald-500"></span>完成</span>
              <span class="flex items-center gap-1"><span class="inline-block h-px w-4 bg-red-500"></span>失败</span>
            </div>
          </div>
          <div v-else class="flex h-24 items-center justify-center text-xs text-slate-300">暂无趋势数据</div>
        </div>
      </div>

      <!-- Top APIs Bar Chart -->
      <div v-if="analytics.topApis.length > 0" class="card-compact rounded-2xl p-5">
        <p class="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">热门接口（按调用次数）</p>
        <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div v-for="api in analytics.topApis" :key="api.apiId" class="flex items-center gap-3">
            <span class="w-28 shrink-0 truncate text-[11px] text-slate-500" :title="api.apiId">
              {{ apiShortName(api.apiId) }}
            </span>
            <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div
                class="h-full rounded-full bg-linear-to-r from-blue-400 to-blue-500 transition-all duration-700"
                :style="{ width: `${Math.max(2, (api.count / (analytics.topApis[0]?.count || 1)) * 100)}%` }"
              ></div>
            </div>
            <span class="w-7 shrink-0 text-right text-[11px] font-semibold text-slate-600">{{ api.count }}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══════════════ 原有欢迎内容 ═══════════════ -->
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
        <h4 class="text-xs font-bold uppercase tracking-wider text-slate-400">SSE 日志实时流</h4>
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
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import { TrendingUpFilled, PowerFilled, MenuBookFilled, TerminalFilled, LayersFilled } from "@vicons/material";
import { API_BASE, taskApi } from "@/api";
import { useSse } from "@/composables/useSse";
import TaskItemDemo from "./TaskItemDemo.vue";

defineProps<{
  activeTasksCount?: number;
}>();

defineEmits<{
  (e: "navigate", view: string): void;
}>();

// ─── SSE ───────────────────────────────────────────────────────────────────
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
      if (sseLogs.value.length > 50) sseLogs.value.shift();
    } catch {
      sseLogs.value.push(event.data);
    }
  },
  onError: () => { sseError.value = "SSE 连接错误"; },
  onOpen: () => { sseError.value = null; },
  onClose: () => { sseError.value = null; },
});

const toggleSSE = () => {
  if (sseConnected.value || isConnecting.value) disconnectSSE();
  else { sseError.value = null; connectSSE(); }
};

const previewTaskItem = () => { showTaskDemo.value = !showTaskDemo.value; };

onBeforeUnmount(() => { disconnectSSE(); });

// ─── Dashboard types ────────────────────────────────────────────────────────
interface TaskStatsData {
  total: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
  polling: number;
  "polling-run": number;
  timeout: number;
}

interface AnalyticsData {
  dailyTrend: Array<{ date: string; total: number; completed: number; failed: number }>;
  topApis: Array<{ apiId: string; count: number }>;
  avgDurationMs: number | null;
  totalRetries: number;
}

// ─── Dashboard state ────────────────────────────────────────────────────────
const isLoadingDashboard = ref(false);
const stats = ref<TaskStatsData>({
  total: 0,
  pending: 0,
  running: 0,
  completed: 0,
  failed: 0,
  polling: 0,
  "polling-run": 0,
  timeout: 0,
});
const analytics = ref<AnalyticsData>({
  dailyTrend: [],
  topApis: [],
  avgDurationMs: null,
  totalRetries: 0,
});

async function loadDashboard() {
  isLoadingDashboard.value = true;
  try {
    const [statsRes, analyticsRes] = await Promise.all([
      taskApi.getTaskStats(),
      taskApi.getTaskAnalytics(),
    ]);
    stats.value = (statsRes as any).data;
    analytics.value = (analyticsRes as any).data;
  } catch {
    // silent
  } finally {
    isLoadingDashboard.value = false;
  }
}

onMounted(loadDashboard);

// ─── KPI computeds ──────────────────────────────────────────────────────────
const successRate = computed(() => {
  if (!stats.value.total) return "--";
  return ((stats.value.completed / stats.value.total) * 100).toFixed(1);
});

const activeCount = computed(
  () => (stats.value.running || 0) + (stats.value.polling || 0) + (stats.value["polling-run"] || 0),
);

const avgDurationText = computed(() => {
  const ms = analytics.value.avgDurationMs;
  if (!ms) return "--";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
});

// ─── Donut chart ────────────────────────────────────────────────────────────
type StatusKey = "completed" | "failed" | "running" | "polling" | "polling-run" | "pending" | "timeout";

const DONUT_R = 54;
const donutCircumference = 2 * Math.PI * DONUT_R;

const STATUS_COLORS: Record<StatusKey, string> = {
  completed: "#10b981",
  running: "#3b82f6",
  polling: "#8b5cf6",
  "polling-run": "#6366f1",
  pending: "#f59e0b",
  failed: "#ef4444",
  timeout: "#94a3b8",
};

const STATUS_LABELS: Record<StatusKey, string> = {
  completed: "已完成",
  running: "执行中",
  polling: "轮询中",
  "polling-run": "轮询执行",
  pending: "等待中",
  failed: "失败",
  timeout: "超时",
};

const DONUT_ORDER: StatusKey[] = ["completed", "running", "polling", "polling-run", "pending", "failed", "timeout"];

const donutSegments = computed(() => {
  const total = stats.value.total || 1;
  let offset = 0;
  return DONUT_ORDER.map((status) => {
    const count = (stats.value as Record<string, number>)[status] || 0;
    const dash = (count / total) * donutCircumference;
    const seg = { status, count, color: STATUS_COLORS[status], dash, offset };
    offset += dash;
    return seg;
  });
});

// ─── Trend chart ────────────────────────────────────────────────────────────
const fmtDate = (d: string): string => {
  const p = d.split("-");
  return `${p[1]}/${p[2]}`;
};

const trendData = computed(() => {
  const trend = analytics.value.dailyTrend;
  if (trend.length < 2) return null;

  const maxVal = Math.max(...trend.map((d) => d.total), 1);
  const W = 380;
  const H = 90;
  const padX = 10;
  const padT = 5;

  const xScale = (i: number) => padX + (i / (trend.length - 1)) * W;
  const yScale = (v: number) => padT + H - (v / maxVal) * H;

  const xPoints = trend.map((_, i) => xScale(i));
  const totalPoints = trend.map((d, i) => `${xScale(i)},${yScale(d.total)}`).join(" ");
  const completedPoints = trend.map((d, i) => `${xScale(i)},${yScale(d.completed)}`).join(" ");
  const failedPoints = trend.map((d, i) => `${xScale(i)},${yScale(d.failed)}`).join(" ");

  const bottomY = padT + H;
  const areaPoints = [
    ...trend.map((d, i) => `${xScale(i)},${yScale(d.total)}`),
    `${xScale(trend.length - 1)},${bottomY}`,
    `${xScale(0)},${bottomY}`,
  ].join(" ");

  return { trend, xPoints, totalPoints, completedPoints, failedPoints, areaPoints };
});

// ─── Helpers ────────────────────────────────────────────────────────────────
const apiShortName = (id: string) => id.split("/").pop() || id;
</script>
