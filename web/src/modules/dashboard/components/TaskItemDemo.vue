<template>
  <div class="space-y-6">
    <div v-for="item in demoTasks" :key="item.taskId" class="rounded-xl border border-slate-200 bg-white p-4">
      <div class="mb-3 flex items-center gap-2">
        <span class="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide" :class="item.badgeClass">
          {{ item.label }}
        </span>
      </div>
      <ResourceTaskItem :task="item.task" @use-prompt="() => {}" @regenerate="() => {}" @delete="() => {}" @quote-task="() => {}" />
    </div>
  </div>
</template>

<script setup lang="ts">
import ResourceTaskItem from "@/modules/chat/components/ResourceTaskItem.vue";

const demoTasks = [
  {
    taskId: "demo-completed",
    label: "已完成",
    badgeClass: "bg-emerald-50 text-emerald-600",
    task: {
      taskId: "demo-completed",
      apiId: "",
      status: "completed",
      progress: 100,
      completedAt: new Date().toISOString(),
      input: { prompt: "一只在樱花树下打盹的橘猫，吉卜力风格，柔和光线" },
      output: {
        content: [
          { type: "image", url: "https://picsum.photos/seed/demo1/400/300" },
          { type: "image", url: "https://picsum.photos/seed/demo2/400/300" },
        ],
      },
    },
  },
  {
    taskId: "demo-processing",
    label: "执行中",
    badgeClass: "bg-blue-50 text-blue-600",
    task: {
      taskId: "demo-processing",
      apiId: "",
      status: "running",
      progress: 47,
      input: { prompt: "赛博朋克城市夜景，霓虹灯倒影，电影感构图" },
      output: { content: [] },
    },
  },
  {
    taskId: "demo-failed",
    label: "失败",
    badgeClass: "bg-red-50 text-red-600",
    task: {
      taskId: "demo-failed",
      apiId: "",
      status: "failed",
      error: "请求超时：上游服务在 30s 内未响应",
      input: { prompt: "水墨风山水画，远山层叠，晨雾缭绕" },
      output: { content: [] },
    },
  },
  {
    taskId: "demo-pending",
    label: "排队中",
    badgeClass: "bg-amber-50 text-amber-600",
    task: {
      taskId: "demo-pending",
      apiId: "",
      status: "pending",
      input: { prompt: "极简主义海报设计，几何图形，莫兰迪色系" },
      output: { content: [] },
    },
  },
];
</script>
