<template>
  <div v-if="toolCall" class="text-[12px] font-sans">
    <div class="flex items-center gap-1.5 text-zinc-500 cursor-pointer select-none" @click="expanded = !expanded">
      <div class="flex items-center shrink-0 text-zinc-400">
        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 6v6l4 2" />
        </svg>
      </div>
      <span class="font-medium text-zinc-600">{{ toolName }}</span>
      <span v-if="taskId" class="text-[9px] px-1.5 py-0 rounded border scale-90 origin-left" :class="statusClass">
        {{ statusLabel }}
      </span>
      <span v-else-if="toolCall.state === 'pending'"
        class="inline-block w-2 h-2 rounded-full border-2 border-zinc-400 border-t-transparent animate-spin ml-0.5" />
      <svg class="ml-auto w-3 h-3 opacity-30 transition-transform duration-200" :class="expanded ? 'rotate-180' : ''"
        viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="4,6 8,10 12,6" />
      </svg>
    </div>

    <div v-if="expanded" class="mt-1.5">
      <div v-if="!taskId" class="text-zinc-400 text-[11px]">
        <span v-if="toolCall.state === 'pending'" class="flex items-center gap-1.5">
          <span class="inline-block w-2 h-2 rounded-full bg-zinc-300 animate-pulse" />
          任务提交中...
        </span>
        <span v-else>无法获取任务 ID</span>
      </div>
      <div v-else-if="!task" class="text-zinc-400 text-[11px] flex items-center gap-1.5 py-1">
        <span class="inline-block w-2 h-2 rounded-full bg-zinc-300 animate-pulse" />
        加载任务中...
      </div>
      <ResourceTaskItem v-else :task="task" @delete="handleDelete" @cancel="handleCancel" @regenerate="() => {}"
        @quote-task="() => {}" @use-prompt="() => {}" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted } from "vue";
import type { ToolCallWithResult } from "@langchain/vue";
import { useTaskStore } from "@/stores/useTaskStore";
import ResourceTaskItem from "@/modules/chat/components/ResourceTaskItem/index.vue";

const TASK_PREFIX = "CC_TASK_";

const props = defineProps<{
  toolCall: ToolCallWithResult;
}>();

const expanded = ref(true);
const taskStore = useTaskStore();
const localTask = ref<any>(null);

const taskId = computed((): string | null => {
  const result = (props.toolCall as any)?.result;
  if (!result) return null;
  const content = result.content;
  if (!content) return null;
  try {
    const parsed = typeof content === "string" ? JSON.parse(content) : content;
    return parsed?.data?.taskId || parsed?.taskId || null;
  } catch {
    return null;
  }
});

const toolName = computed(() => {
  const name = (props.toolCall as any)?.call?.name || "";
  return name.startsWith(TASK_PREFIX) ? name.slice(TASK_PREFIX.length) : name;
});

const task = computed(() => {
  const id = taskId.value;
  if (!id) return null;
  return taskStore.tasks.find((t) => t.taskId === id || t.id === id) || localTask.value;
});

const statusClass = computed(() => {
  const s = task.value?.status;
  if (!s || s === "pending") return "bg-amber-50 text-amber-600 border-amber-100";
  if (s === "running" || s === "polling" || s === "polling-run") return "bg-blue-50 text-blue-600 border-blue-100";
  if (s === "completed") return "bg-green-50 text-green-600 border-green-100";
  if (s === "failed") return "bg-red-50 text-red-600 border-red-100";
  return "bg-zinc-50 text-zinc-500 border-zinc-100";
});

const statusLabel = computed(() => {
  const s = task.value?.status;
  if (!s || s === "pending") return "等待中";
  if (s === "running") return "运行中";
  if (s === "polling" || s === "polling-run") return "处理中";
  if (s === "completed") return "已完成";
  if (s === "failed") return "失败";
  return s;
});

async function loadTask(id: string) {
  if (taskStore.tasks.find((t) => t.taskId === id || t.id === id)) return;
  try {
    const res = await taskStore.fetchTaskDetail(id);
    if (res) {
      localTask.value = res;
      taskStore.upsertTask(res as any);
    }
  } catch (e) {
    console.warn("加载任务详情失败:", e);
  }
}

async function handleDelete(taskId: string) {
  await taskStore.deleteTask(taskId);
}

async function handleCancel(task: any) {
  const id = task?.taskId || task?.id;
  if (id) await taskStore.cancelTask(id);
}

onMounted(() => {
  if (taskId.value) loadTask(taskId.value);
});

watch(taskId, (id) => {
  if (id) loadTask(id);
});
</script>
