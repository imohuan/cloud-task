<template>
  <div v-if="toolCall" class="text-[12px] font-sans rounded-lg border border-zinc-200 bg-white shadow-sm overflow-hidden">
    <!-- Compact title bar -->
    <div class="flex items-center gap-1.5 px-2.5 py-1.5 bg-zinc-50 border-b border-zinc-100 select-none">
      <!-- Clock icon -->
      <svg class="w-3 h-3 shrink-0 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
      </svg>

      <!-- Tool name -->
      <span class="font-medium text-zinc-600 text-[11px] truncate">{{ toolName }}</span>

      <!-- Status badge -->
      <span v-if="task" class="text-[8.5px] px-1.5 py-px rounded border font-medium shrink-0" :class="statusClass">
        {{ statusLabel }}
      </span>
      <span v-else-if="(toolCall as any).state === 'pending'"
        class="inline-block w-2 h-2 rounded-full border-2 border-zinc-400 border-t-transparent animate-spin shrink-0" />

      <!-- Spacer -->
      <div class="flex-1" />

      <!-- JSON toggle -->
      <button type="button"
        class="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] border transition-colors shrink-0"
        :class="showJson
          ? 'bg-zinc-700 text-white border-zinc-700'
          : 'text-zinc-400 border-zinc-200 hover:text-zinc-600 hover:border-zinc-300'"
        @click="showJson = !showJson">
        <svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
          stroke-linecap="round" stroke-linejoin="round">
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
        JSON
      </button>
    </div>

    <!-- Body -->
    <div class="p-2.5">
      <!-- No task id yet -->
      <div v-if="!taskId" class="text-zinc-400 text-[11px] py-1">
        <span v-if="(toolCall as any).state === 'pending'" class="flex items-center gap-1.5">
          <span class="inline-block w-2 h-2 rounded-full bg-zinc-300 animate-pulse" />
          任务提交中...
        </span>
        <span v-else>无法获取任务 ID</span>
      </div>

      <!-- Loading task -->
      <div v-else-if="!task" class="text-zinc-400 text-[11px] flex items-center gap-1.5 py-1">
        <span class="inline-block w-2 h-2 rounded-full bg-zinc-300 animate-pulse" />
        加载任务中...
      </div>

      <!-- JSON view: 2-column input / output -->
      <div v-else-if="showJson" class="flex gap-2 font-mono text-[10px]">
        <!-- Input column -->
        <div class="flex-1 min-w-0 rounded border border-zinc-100 bg-zinc-50/60 overflow-hidden">
          <div class="px-2 py-1 border-b border-zinc-100 text-[9px] uppercase tracking-widest text-zinc-400 font-sans">输入</div>
          <div class="p-2 grid gap-y-0.5 max-h-[260px] overflow-y-auto" style="grid-template-columns: auto 1fr">
            <template v-for="[key, val] in argEntries" :key="key">
              <span class="text-zinc-400 pr-2 py-0.5 shrink-0 break-all">{{ key }}</span>
              <span class="text-zinc-700 py-0.5 break-all">{{ formatVal(val) }}</span>
            </template>
          </div>
        </div>
        <!-- Output column -->
        <div class="flex-1 min-w-0 rounded border border-zinc-100 bg-zinc-50/60 overflow-hidden">
          <div class="px-2 py-1 border-b border-zinc-100 text-[9px] uppercase tracking-widest text-zinc-400 font-sans">输出</div>
          <div class="p-2 max-h-[260px] overflow-y-auto">
            <span v-if="(toolCall as any).state === 'pending'" class="flex items-center gap-1.5 text-zinc-400 font-sans">
              <span class="inline-block w-2 h-2 rounded-full border-2 border-zinc-400 border-t-transparent animate-spin" />
              运行中...
            </span>
            <pre v-else class="whitespace-pre-wrap break-all text-zinc-700">{{ resultContent }}</pre>
          </div>
        </div>
      </div>

      <!-- Task view -->
      <ResourceTaskItem v-else :task="task" :hide-actions="true"
        @delete="handleDelete" @cancel="handleCancel" @regenerate="() => {}"
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

const showJson = ref(false);
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

const argEntries = computed(() => {
  const args = (props.toolCall as any)?.call?.args;
  if (args && typeof args === "object" && !Array.isArray(args)) {
    return Object.entries(args);
  }
  return args !== undefined ? [["value", args]] : [];
});

const resultContent = computed(() => {
  const content = (props.toolCall as any)?.result?.content;
  if (content === undefined || content === null) return "—";
  if (typeof content === "string") {
    try {
      return JSON.stringify(JSON.parse(content), null, 2);
    } catch {
      return content;
    }
  }
  try {
    return JSON.stringify(content, null, 2);
  } catch {
    return String(content);
  }
});

function formatVal(val: any): string {
  if (typeof val === "string") return val;
  return JSON.stringify(val);
}

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

<style scoped>
:deep([title="使用这个提示词"]) {
  display: none;
}
</style>
