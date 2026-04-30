<template>
  <WelcomeComp
    :active-tasks-count="taskStore.activeTasksCount"
    @navigate="(view: string) => router.push({ name: view })"
  />
</template>

<script setup lang="ts">
import { useRouter } from "vue-router";
import { useTaskStore } from "@/stores";
import WelcomeComp from "@/modules/dashboard/components/WelcomePage.vue";

const taskStore = useTaskStore();
const router = useRouter();
</script>
