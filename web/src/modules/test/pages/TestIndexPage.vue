<template>
  <RouterView v-if="route.name !== 'test'" />
  <div v-else class="h-full overflow-y-auto bg-slate-50">
    <header class="border-b border-slate-200 bg-white">
      <div class="mx-auto max-w-5xl px-6 py-8">
        <div class="flex items-center gap-3">
          <div class="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900">
            <svg class="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h1 class="text-lg font-bold text-slate-900">测试中心</h1>
            <p class="text-xs text-slate-400">UI 组件与功能调试</p>
          </div>
        </div>
      </div>
    </header>

    <div class="mx-auto max-w-5xl px-6 py-8">
      <div v-if="tests.length === 0" class="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white py-20 text-center">
        <div class="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100">
          <svg class="h-6 w-6 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </div>
        <p class="text-sm font-medium text-slate-600">暂无测试用例</p>
        <p class="mt-1 text-xs text-slate-400">在 modules/test/pages 中添加测试页面</p>
      </div>

      <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <a
          v-for="test in tests"
          :key="test.path"
          :href="test.path"
          class="group flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-slate-300 hover:shadow-md"
        >
          <div class="flex items-start justify-between">
            <div
              class="flex h-9 w-9 items-center justify-center rounded-xl text-base"
              :class="test.iconBg ?? 'bg-slate-100'"
            >
              {{ test.icon ?? '🧪' }}
            </div>
            <span
              v-if="test.badge"
              class="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
              :class="getBadgeClass(test.badgeColor)"
            >
              {{ test.badge }}
            </span>
          </div>
          <div>
            <h3 class="text-sm font-semibold text-slate-800 transition-colors group-hover:text-slate-900">
              {{ test.title }}
            </h3>
            <p class="mt-0.5 text-xs leading-relaxed text-slate-400">{{ test.description }}</p>
          </div>
        </a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRoute } from "vue-router";

const route = useRoute();

interface TestEntry {
  title: string;
  description: string;
  path: string;
  icon?: string;
  iconBg?: string;
  badge?: string;
  badgeColor?: "blue" | "green" | "amber" | "red" | "purple" | "slate";
}

const tests: TestEntry[] = [
  {
    title: "Toast 通知",
    description: "测试各类型通知弹出效果：成功、错误、警告、提示",
    path: "/test/toast",
    icon: "🔔",
    iconBg: "bg-blue-50",
    badge: "UI",
    badgeColor: "blue",
  },
  {
    title: "SSE 实时日志",
    description: "测试 SSE 连接与服务端实时日志流推送",
    path: "/test/sse",
    icon: "📡",
    iconBg: "bg-purple-50",
    badge: "网络",
    badgeColor: "purple",
  },
  {
    title: "任务项组件",
    description: "ResourceTaskItem 组件各状态静态预览：完成、执行中、失败",
    path: "/test/task-item",
    icon: "🧩",
    iconBg: "bg-rose-50",
    badge: "UI",
    badgeColor: "red",
  },
];

const getBadgeClass = (color?: TestEntry["badgeColor"]) => {
  const map: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    red: "bg-red-50 text-red-600",
    purple: "bg-purple-50 text-purple-600",
    slate: "bg-slate-100 text-slate-600",
  };
  return map[color ?? "slate"];
};
</script>
