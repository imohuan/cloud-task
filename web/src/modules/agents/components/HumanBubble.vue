<template>
  <div class="flex justify-end">
    <div class="group relative max-w-[85%]">
      <!-- View mode -->
      <template v-if="!editing">
        <div class="relative px-4 py-2.5  rounded-2xl rounded-br-sm bg-zinc-100 flex gap-1 overflow-hidden">
          <div ref="bubbleRef"
            class="human-bubble flex-1 text-[14px] text-zinc-800 leading-relaxed whitespace-pre-wrap transition-all duration-300 overflow-hidden"
            :style="{ maxHeight: expanded || !hasOverflow ? 'none' : '300px' }">
            <slot />
          </div>
          <!-- Expand / collapse icon button (only when content overflows) -->
          <button v-if="hasOverflow"
            class="size-6 flex items-center justify-center rounded-full bg-zinc-200 hover:bg-zinc-300 text-zinc-400 hover:text-zinc-600 transition-colors shadow-sm"
            @click="expanded = !expanded">
            <svg class="w-3.5 h-3.5 transition-transform duration-200" :class="expanded ? 'rotate-180' : ''"
              viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="4,6 8,10 12,6" />
            </svg>
          </button>
        </div>
      </template>

      <!-- Edit mode -->
      <template v-else>
        <textarea ref="textareaRef" v-model="draft" rows="8" :style="{ width: editWidth }"
          class="rounded-2xl rounded-br-sm bg-zinc-100 px-4 py-2.5 text-[14px] text-zinc-800 leading-relaxed resize-none outline-none ring-2 ring-zinc-300 focus:ring-zinc-400 transition"
          @keydown.enter.exact.prevent="save" @keydown.esc="cancel" />
        <div class="flex justify-end gap-2 mt-1.5">
          <button class="text-[12px] text-gray-400 hover:text-gray-600 transition-colors px-2 py-0.5" @click="cancel">
            取消
          </button>
          <button class="text-[12px] bg-zinc-600 hover:bg-zinc-700 text-white rounded-md px-3 py-0.5 transition-colors"
            @click="save">
            保存
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, onMounted, watch } from "vue";

const props = defineProps<{ content: string }>();
const emit = defineEmits<{ (e: "edit", val: string): void }>();

const editing = ref(false);
const draft = ref("");
const bubbleRef = ref<HTMLElement | null>(null);
const textareaRef = ref<HTMLTextAreaElement | null>(null);
const editWidth = ref("");
const hasOverflow = ref(false);
const expanded = ref(false);

function checkOverflow() {
  const el = bubbleRef.value;
  if (!el) return;
  el.style.maxHeight = "300px";
  hasOverflow.value = el.scrollHeight > el.clientHeight;
  el.style.maxHeight = "";
}

onMounted(checkOverflow);
watch(() => props.content, () => nextTick(checkOverflow));

function startEdit() {
  const measured = bubbleRef.value ? bubbleRef.value.offsetWidth : 0;
  editWidth.value = Math.max(measured, 400) + "px";
  draft.value = props.content;
  editing.value = true;
  nextTick(() => {
    textareaRef.value?.focus();
    textareaRef.value?.select();
  });
}

function save() {
  if (draft.value.trim()) {
    emit("edit", draft.value.trim());
  }
  editing.value = false;
}

function cancel() {
  editing.value = false;
}


defineExpose({ startEdit });
</script>


<style scoped>
:deep(.human-bubble p) {
  margin-bottom: 0 !important
}
</style>