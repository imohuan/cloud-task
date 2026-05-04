<template>
  <div
    v-if="visible"
    ref="menuRef"
    class="fixed z-[60] min-w-[140px] rounded-lg border border-slate-200 bg-white py-1 shadow-xl"
    :style="{ top: y + 'px', left: x + 'px' }"
  >
    <template v-if="!isMultiline">
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
      <div class="mx-3 my-1 h-px bg-slate-100"></div>
    </template>
    <button
      @click="$emit('copy')"
      class="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
    >
      <ContentCopyRound class="h-4 w-4 text-slate-400" />
      复制选中
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { onClickOutside } from "@vueuse/core";
import { SearchRound, BlockRound, ContentCopyRound } from "@vicons/material";

defineProps<{
  visible: boolean;
  x: number;
  y: number;
  isMultiline?: boolean;
}>();

const emit = defineEmits<{
  "add-to-search": [];
  "add-to-exclude": [];
  copy: [];
  close: [];
}>();

const menuRef = ref<HTMLElement | null>(null);
onClickOutside(menuRef, () => emit("close"));
</script>
