<template>
  <TaskDetail
    :task-id="taskId"
    @close="handleClose"
    @recreate-task="ctx.handleRecreateTask"
    @open-api-form="ctx.handleOpenApiForm"
  />
</template>

<script setup lang="ts">
import { computed, inject } from "vue";
import { useRoute, useRouter } from "vue-router";
import TaskDetail from "@/modules/task/components/TaskDetail.vue";

const route = useRoute();
const router = useRouter();
const ctx = inject<Record<string, any>>("layoutContext")!;

const taskId = computed(() => route.params.taskId as string);

const handleClose = () => {
  if (window.history.length > 1) {
    router.back();
  } else {
    router.push({ name: "tasks" });
  }
};
</script>
