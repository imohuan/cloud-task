<template>
  <div class="p-3 lg:p-6">
  <TaskCenter
    :tasks="taskStore.tasks"
    :task-stats="taskStore.taskStats"
    :tasks-loading="taskStore.loading"
    :pagination="taskStore.pagination"
    @refresh="ctx.refreshTasks"
    @update:page="ctx.handlePageChange"
    @update:pageSize="ctx.handlePageSizeChange"
    @filterChange="ctx.handleFilterChange"
    @view-detail="router.push({ name: 'task-detail', params: { taskId: $event } })"
    @cancel-task="ctx.handleCancelTask"
    @recreate-task="ctx.handleRecreateTask"
    @open-api-form="ctx.handleOpenApiForm"
  />
  </div>
</template>

<script setup lang="ts">
import { inject } from "vue";
import { useRouter } from "vue-router";
import { useTaskStore } from "@/stores";
import TaskCenter from "@/modules/task/components/TaskCenter.vue";

const taskStore = useTaskStore();
const ctx = inject<Record<string, any>>("layoutContext")!;
const router = useRouter();
</script>
