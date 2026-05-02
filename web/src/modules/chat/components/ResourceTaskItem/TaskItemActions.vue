<template>
  <div class="flex items-center gap-1.5">
    <button @click="emit('regenerate')"
      class="flex h-7 items-center gap-1.5 rounded bg-slate-100 px-3 text-xs font-medium text-slate-700 transition-all hover:bg-slate-200 active:scale-95">
      <i class="fa-solid fa-rotate-right text-[10px]"></i>重新生成
    </button>
    <button @click="emit('quote-task')"
      class="flex h-7 items-center gap-1.5 rounded bg-slate-100 px-3 text-xs font-medium text-slate-700 transition-all hover:bg-slate-200 active:scale-95">
      <i class="fa-regular fa-comment text-[10px]"></i>重做
    </button>
    <button @click="emit('view-log')"
      class="flex h-7 items-center gap-1.5 rounded bg-slate-100 px-3 text-xs font-medium text-slate-700 transition-all hover:bg-slate-200 active:scale-95">
      <i class="fa-regular fa-file-lines text-[10px]"></i>任务
    </button>
    <button @click="deleteDialogVisible = true"
      class="flex h-7 items-center gap-1.5 rounded bg-slate-100 px-3 text-xs font-medium text-slate-700 transition-all hover:bg-red-50 hover:text-red-500 active:scale-95">
      <i class="fa-regular fa-trash-can text-[10px]"></i>删除
    </button>
    <ConfirmDialog v-model="deleteDialogVisible" title="删除任务" content="确定要删除该任务吗？此操作不可恢复。" type="danger"
      confirm-text="删除" @confirm="handleDeleteConfirm" />
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import ConfirmDialog from "@/components/ConfirmDialog.vue";

const props = defineProps<{
  taskId: string;
}>();

const emit = defineEmits<{
  (e: "regenerate"): void;
  (e: "quote-task"): void;
  (e: "view-log"): void;
  (e: "delete", taskId: string): void;
}>();

const deleteDialogVisible = ref(false);

function handleDeleteConfirm() {
  deleteDialogVisible.value = false;
  emit("delete", props.taskId);
}
</script>
