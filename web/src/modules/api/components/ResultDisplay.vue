<template>
  <div v-if="result || error" class="space-y-2">
    <div v-if="error" class="rounded-sm border border-red-200 bg-red-50 p-3">
      <div class="flex items-start gap-2">
        <CancelFilled class="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
        <div class="flex-1">
          <h4 class="text-sm font-medium text-red-800">调用失败</h4>
          <p class="mt-1 text-xs text-red-600">{{ error.message }}</p>
        </div>
      </div>
    </div>
    <div v-if="result" class="rounded border border-gray-200 bg-white p-3">
      <div class="mb-2 flex items-center gap-2">
        <CheckCircleFilled class="h-4 w-4 text-green-500" />
        <h4 class="text-sm font-medium text-gray-900">调用成功</h4>
      </div>
      <div class="rounded-sm bg-gray-50 p-2">
        <pre class="overflow-x-auto text-xs whitespace-pre-wrap text-gray-700">{{
          JSON.stringify(result.data || result, null, 2)
        }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { CancelFilled, CheckCircleFilled } from "@vicons/material";

defineProps<{
  result?: { data?: unknown } | null;
  error?: { message: string } | null;
}>();
</script>
