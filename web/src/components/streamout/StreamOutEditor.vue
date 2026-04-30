<template>
  <div class="relative flex h-full overflow-hidden font-mono text-[13px]">
    <div
      ref="lineNumbersRef"
      class="select-none overflow-hidden bg-[#f6f8fa] py-4 pr-3 pl-4 text-right text-slate-400"
    >
      <div v-for="n in lineCount" :key="n" class="h-5 leading-5">{{ n }}</div>
    </div>

    <textarea
      ref="textareaRef"
      v-model="model"
      wrap="off"
      class="flex-1 resize-none border-none bg-[#f6f8fa] py-4 pr-4 pl-2 text-slate-700 outline-none"
      style="line-height: 20px; tab-size: 2"
      spellcheck="false"
      @scroll="syncScroll"
      @keydown="onKeydown"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, nextTick } from "vue";

const model = defineModel<string>({ default: "" });

const lineCount = computed(() => {
  if (!model.value) return 1;
  return model.value.split("\n").length;
});

const textareaRef = ref<HTMLTextAreaElement>();
const lineNumbersRef = ref<HTMLDivElement>();

function syncScroll() {
  if (textareaRef.value && lineNumbersRef.value) {
    lineNumbersRef.value.scrollTop = textareaRef.value.scrollTop;
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Tab") {
    e.preventDefault();
    const target = e.target as HTMLTextAreaElement;
    const start = target.selectionStart;
    const end = target.selectionEnd;
    model.value = model.value.substring(0, start) + "  " + model.value.substring(end);
    nextTick(() => {
      target.selectionStart = target.selectionEnd = start + 2;
    });
  }
}
</script>
