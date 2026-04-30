<template>
  <div class="rounded border border-red-200 bg-red-50 p-4">
    <div class="flex items-center gap-3">
      <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100">
        <i class="fa-solid fa-circle-exclamation text-red-500"></i>
      </div>
      <div class="min-w-0">
        <div class="text-sm font-medium text-red-700">生成失败</div>
        <div v-if="error" class="mt-0.5 text-xs break-words text-red-500">{{ error }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  error?: string;
}>();
</script>
