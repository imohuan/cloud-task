<template>
  <div
    v-if="visible"
    class="fixed z-[60] min-w-[140px] rounded-lg border border-slate-200 bg-white py-1 shadow-xl"
    :style="{ top: y + 'px', left: x + 'px' }"
  >
    <button
      @click="$emit('add-to-search')"
      class="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
    >
      <SearchRound class="h-4 w-4 text-blue-500" />
      加入搜索
    </button>
    <button
      @click="$emit('add-to-exclude')"
      class="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
    >
      <BlockRound class="h-4 w-4 text-red-500" />
      加入排除
    </button>
  </div>
</template>

<script setup lang="ts">
import { SearchRound, BlockRound } from "@vicons/material";

defineProps<{
  visible: boolean;
  x: number;
  y: number;
}>();

defineEmits<{
  "add-to-search": [];
  "add-to-exclude": [];
}>();
</script>
