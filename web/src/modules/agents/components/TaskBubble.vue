<template>
  <div class="text-[12px] font-sans">
    <div class="flex items-center gap-1.5 text-zinc-500 cursor-pointer select-none" @click="expanded = !expanded">
      <div class="flex items-center shrink-0 text-zinc-400">
        <svg v-if="data.type === 'create'" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>
        <svg v-else-if="data.type === 'list'" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>
        <svg v-else-if="data.type === 'update'" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        <svg v-else-if="data.type === 'delete'" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M10 11v6M14 11v6"/></svg>
      </div>
      <span class="font-medium text-zinc-600">任务列表</span>
      <span v-if="data.actionTag" :class="{
        'bg-green-50 text-green-600 border-green-100': data.type === 'create',
        'bg-blue-50 text-blue-600 border-blue-100': data.type === 'list',
        'bg-amber-50 text-amber-600 border-amber-100': data.type === 'update',
        'bg-red-50 text-red-600 border-red-100': data.type === 'delete'
      }" class="text-[9px] px-1.5 py-0 rounded border scale-90 origin-left">{{ data.actionTag }}</span>
    </div>

    <!-- 展开后的 UI -->
    <div v-if="expanded" class="mt-1.5 border-l border-zinc-100">
      <div class="w-full max-w-[480px] bg-white border border-zinc-100 shadow-sm rounded-lg p-2.5 overflow-hidden">
        <!-- 列表区域 -->
        <div class="custom-scroll max-h-[300px] overflow-y-auto pr-1">
          <div v-for="task in data.tasks" :key="task.id" 
               class="micro-timeline-item relative pl-5 pb-2 last:pb-0 group"
               :class="{'is-completed': task.status === 'completed'}">
            <!-- 轴线 -->
            <div v-if="data.tasks.indexOf(task) !== data.tasks.length - 1" class="absolute left-[3.5px] top-[14px] bottom-0 w-px bg-zinc-50 group-[.is-completed]:bg-zinc-100 transition-colors"></div>
            
            <!-- 状态圆点 -->
            <div class="absolute left-0 top-[3px] z-10">
              <div v-if="task.status !== 'completed'" 
                   class="w-2 h-2 rounded-full border border-zinc-300 bg-white group-hover:border-zinc-900 transition-colors"></div>
              <div v-else 
                   class="w-2 h-2 rounded-full bg-zinc-900 flex items-center justify-center">
                <svg class="w-1.5 h-1.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
              </div>
            </div>

            <!-- 内容 -->
            <div class="transition-all duration-300">
              <div class="flex items-center gap-1.5 mb-0.5">
                <span v-if="task.priority" :class="{
                  'text-red-500 bg-red-50 border-red-100': task.priority === 'high',
                  'text-amber-500 bg-amber-50 border-amber-100': task.priority === 'medium',
                  'text-blue-500 bg-blue-50 border-blue-100': task.priority === 'low'
                }" class="text-[8px] font-bold px-1 py-0 border rounded-[3px] scale-90 origin-left shrink-0">
                  {{ { high: '高', medium: '中', low: '低' }[task.priority] || task.priority }}
                </span>
                <h4 class="text-[11px] font-semibold text-zinc-700 leading-tight group-[.is-completed]:line-through group-[.is-completed]:italic group-[.is-completed]:text-zinc-400">
                  {{ task.title }}
                </h4>
              </div>
              <p v-if="task.description" class="text-[8.5px] text-zinc-400/70 font-light leading-snug line-clamp-2 pr-2">
                {{ task.description }}
              </p>
            </div>
          </div>
          
          <!-- 空状态 -->
          <div v-if="data.tasks.length === 0" class="text-center py-4 text-zinc-400 italic text-[11px]">
            没有符合条件的任务
          </div>
        </div>

        <!-- 错误信息 -->
        <div v-if="data.errors && data.errors.length > 0" class="mt-2 pt-2 border-t border-zinc-50">
          <div v-for="err in data.errors" :key="err" class="text-[10px] text-red-400 flex items-start gap-1">
            <svg class="w-2.5 h-2.5 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            {{ err }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ToolCallWithResult } from "@langchain/vue";
import { computed, ref } from "vue";

const props = defineProps<{
  toolCall: ToolCallWithResult;
}>();

const expanded = ref(false);

interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority?: 'low' | 'medium' | 'high';
  tags?: string[];
}

interface TaskData {
  type: string;
  title: string;
  actionTag?: string;
  summary: string;
  tasks: Task[];
  count?: number;
  errors?: string[];
}

const data = computed((): TaskData => {
  const call = props.toolCall?.call;
  if (!call) return { type: "error", title: "未知操作", summary: "", tasks: [] };

  const { name, args } = call;
  const result = props.toolCall?.result;
  let parsedResult: any = result;
  
  // Handle LangChain tool result object where content is a JSON string
  if (result && typeof result === 'object' && 'content' in result) {
    const content = (result as any).content;
    if (typeof content === 'string' && (content.startsWith('[') || content.startsWith('{'))) {
      try {
        parsedResult = JSON.parse(content);
      } catch (e) {
        parsedResult = content;
      }
    } else {
      parsedResult = content;
    }
  } else if (typeof result === 'string') {
    try {
      parsedResult = JSON.parse(result);
    } catch (e) {
      // If it's not JSON, keep it as string
    }
  }

  if (name === "create_tasks") {
    const tasks = parsedResult?.tasks || args?.tasks || [];
    return {
      type: "create",
      title: "创建任务",
      actionTag: "创建",
      summary: tasks.length > 0 ? `创建了 ${tasks.length} 个任务` : "正在创建...",
      tasks: tasks.map((t: any) => ({
        ...t,
        status: t.status || 'pending'
      })),
      count: tasks.length
    };
  } else if (name === "list_tasks") {
    const tasks = parsedResult?.tasks || args?.tasks || [];
    return {
      type: "list",
      title: "任务列表",
      actionTag: "查询",
      summary: tasks.length > 0 ? `共 ${tasks.length} 个任务` : "暂无任务",
      tasks: tasks,
      count: tasks.length
    };
  } else if (name === "update_tasks") {
    const tasks = parsedResult?.tasks || args?.tasks || [];
    return {
      type: "update",
      title: "更新任务",
      actionTag: "修改",
      summary: tasks.length > 0 ? `更新了 ${args?.tasks?.length || 1} 个任务` : "正在更新...",
      tasks: tasks,
      count: tasks.length
    };
  } else if (name === "delete_tasks") {
    const tasks = parsedResult?.tasks || [];
    return {
      type: "delete",
      title: "删除任务",
      actionTag: "删除",
      summary: `删除了 ${args?.tasks?.length || 1} 个任务`,
      tasks: tasks,
      count: tasks.length
    };
  }

  return { type: "error", title: "未知操作", summary: "", tasks: [] };
});
</script>

<style scoped>
.custom-scroll::-webkit-scrollbar {
  width: 3px;
}
.custom-scroll::-webkit-scrollbar-thumb {
  background: #f1f1f1;
  border-radius: 10px;
}
.custom-scroll::-webkit-scrollbar-thumb:hover {
  background: #e5e5e5;
}
</style>
