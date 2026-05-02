<template>
  <div class="p-3 lg:p-6">
  <ApiForm
    v-if="ctx.currentApi"
    :current-api="ctx.currentApi"
    :current-platform="sidebarStore.currentPlatform"
    :auth-profiles="authProfileStore.profiles"
    :is-submitting="ctx.isSubmitting"
    :last-result="ctx.lastResult"
    :prefilled-data="ctx.prefilledFormData"
    @submit="ctx.submitApiCall"
    @reset="ctx.resetApiForm"
    @view-tasks="router.push({ name: 'tasks' })"
    @mounted="ctx.clearPrefilledFormData()"
  />
  <div v-else class="flex h-64 items-center justify-center text-sm text-slate-400">
    请从左侧选择一个 API
  </div>
  </div>
</template>

<script setup lang="ts">
import { inject } from "vue";
import { useRouter } from "vue-router";
import { useAuthProfileStore, useSidebarStore } from "@/stores";
import ApiForm from "@/modules/api/components/ApiForm.vue";

const router = useRouter();
const authProfileStore = useAuthProfileStore();
const sidebarStore = useSidebarStore();
const ctx = inject<Record<string, any>>("layoutContext")!;
</script>
