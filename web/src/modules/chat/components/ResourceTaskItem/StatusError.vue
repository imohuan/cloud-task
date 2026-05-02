<template>
  <div class="rounded border border-red-200 bg-red-50 p-4">
    <div class="flex items-start gap-3">
      <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100">
        <i class="fa-solid fa-circle-exclamation text-red-500"></i>
      </div>
      <div class="min-w-0 space-y-1">
        <div class="text-sm font-medium text-red-700">生成失败</div>
        <template v-if="error && typeof error === 'object'">
          <div v-if="error.code" class="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold uppercase bg-red-100 text-red-700 border border-red-200">
            {{ error.code }}
          </div>
          <div v-if="error.message" class="text-xs break-words text-red-500">{{ error.message }}</div>
          <!-- <pre v-if="error.details" class="font-mono text-[10px] text-red-400 whitespace-pre-wrap break-all">{{ error.details }}</pre> -->
        </template>
        <div v-else-if="error" class="text-xs break-words text-red-500">{{ error }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  error?: { code?: string; message?: string; details?: string } | string;
}>();
</script>
