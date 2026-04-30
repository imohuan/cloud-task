<template>
  <TestLayout title="任务项组件" description="ResourceTaskItem 组件各状态的静态预览" badge="UI" badge-color="purple">
    <TestCard title="交互测试" subtitle="切换状态与输出内容类型，实时预览组件效果">
      <div class="space-y-3">
        <div class="flex flex-wrap items-center gap-1">
          <span class="mr-1 text-xs text-gray-400">状态</span>
          <button
            v-for="s in statuses"
            :key="s.value"
            class="flex h-8 items-center justify-center gap-1.5 rounded-md px-2 text-xs transition-all"
            :class="currentStatus === s.value ? 'border border-gray-200 bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'"
            @click="currentStatus = s.value"
          >
            {{ s.label }}
          </button>
        </div>
        <div class="flex flex-wrap items-center gap-1">
          <span class="mr-1 text-xs text-gray-400">内容</span>
          <button
            v-for="t in contentTypes"
            :key="t.value"
            class="flex h-8 items-center justify-center gap-1.5 rounded-md px-2 text-xs transition-all"
            :class="currentContentType === t.value ? 'border border-gray-200 bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'"
            @click="currentContentType = t.value"
          >
            {{ t.label }}
          </button>
        </div>
        <div class="rounded-xl border border-slate-200 bg-white p-4">
          <ResourceTaskItem
            :task="interactiveTask"
            :resource-type-override="resourceTypeOverride"
            @use-prompt="() => {}"
            @regenerate="() => {}"
            @delete="() => {}"
            @quote-task="() => {}"
          />
        </div>
      </div>
    </TestCard>

    <TestCard title="静态预览" subtitle="含已完成、执行中、失败三种状态">
      <TaskItemDemo />
    </TestCard>
  </TestLayout>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import TestLayout from "@/modules/test/components/TestLayout.vue";
import TestCard from "@/modules/test/components/TestCard.vue";
import TaskItemDemo from "@/modules/dashboard/components/TaskItemDemo.vue";
import ResourceTaskItem from "@/modules/chat/components/ResourceTaskItem/index.vue";

const statuses = [
  { value: "pending", label: "排队中" },
  { value: "running", label: "执行中" },
  { value: "completed", label: "已完成" },
  { value: "failed", label: "失败" },
];

const contentTypes = [
  { value: "image", label: "图片" },
  { value: "video", label: "视频" },
  { value: "audio", label: "音频" },
  { value: "text", label: "文本" },
  { value: "file", label: "文件" },
  { value: "empty", label: "无资源" },
];

const currentStatus = ref("completed");
const currentContentType = ref("image");

const contentMap: Record<string, any[]> = {
  image: [
    { type: "image", url: "https://picsum.photos/seed/rti1/400/300" },
    { type: "image", url: "https://picsum.photos/seed/rti2/400/300" },
    { type: "image", url: "https://picsum.photos/seed/rti3/400/300" },
    { type: "image", url: "https://picsum.photos/seed/rti4/400/300" },
  ],
  video: [{ type: "video", url: "https://www.w3schools.com/html/mov_bbb.mp4" }],
  audio: [{ type: "audio", url: "https://www.w3schools.com/html/horse.ogg" }],
  text: [{ type: "text", text: "这是一段由 AI 生成的文本内容。包含了对输入 Prompt 的理解与创意发挥，语言流畅自然，逻辑清晰。" }],
  file: [{ type: "file", url: "https://example.com/output.zip" }],
  empty: [],
};

const RUNNING_TYPES = new Set(["image", "video", "audio"]);
const resourceTypeOverride = computed(() =>
  currentStatus.value === "running" && RUNNING_TYPES.has(currentContentType.value)
    ? currentContentType.value
    : undefined,
);

const interactiveTask = computed(() => ({
  taskId: "interactive-demo",
  apiId: "",
  status: currentStatus.value,
  progress: currentStatus.value === "running" ? 62 : 100,
  elapsed: currentStatus.value === "completed" ? "3.2s" : undefined,
  error: currentStatus.value === "failed" ? "请求超时：上游服务在 30s 内未响应" : undefined,
  completedAt: currentStatus.value === "completed" ? new Date().toISOString() : undefined,
  input: { prompt: "黄昏时分的海边，橙红色天空，远处帆船轮廓，胶片摄影质感" },
  output: {
    content: currentStatus.value === "completed" ? (contentMap[currentContentType.value] ?? []) : [],
  },
}));
</script>
