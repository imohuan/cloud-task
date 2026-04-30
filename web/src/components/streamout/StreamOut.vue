<template>
  <div
    class="flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
  >
    <div class="flex items-center justify-between border-b border-slate-100 px-4 py-3">
      <div class="flex items-center gap-2">
        <span class="text-sm font-semibold text-slate-700">Vue Stream Markdown</span>
        <span class="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
          v0.3.2
        </span>
      </div>
    </div>

    <div class="flex flex-1 overflow-hidden">
      <div
        v-show="showEditor"
        class="flex w-1/2 flex-col border-r border-slate-100"
      >
        <StreamOutEditor :model-value="text" @update:model-value="onEditorUpdate" />
      </div>
    <div
      :class="showEditor ? 'w-1/2' : 'w-full'"
      class="h-full overflow-hidden bg-white"
    >
      <StreamOutPreview :content="preview" :auto-scroll="autoScroll" />
    </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import StreamOutEditor from "./StreamOutEditor.vue";
import StreamOutPreview from "./StreamOutPreview.vue";

defineProps<{
  text: string;
  preview: string;
  showEditor?: boolean;
  autoScroll?: boolean;
}>();

const emit = defineEmits<{
  "update:text": [val: string];
}>();

function onEditorUpdate(val: string) {
  emit("update:text", val);
}
</script>
