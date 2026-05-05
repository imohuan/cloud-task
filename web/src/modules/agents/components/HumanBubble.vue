<template>
  <div class="flex justify-end">
    <div class="group relative max-w-[85%]">
      <!-- View mode -->
      <template v-if="!editing">
        <div class="relative px-4 py-3 rounded-2xl rounded-br-sm bg-zinc-100 flex gap-1 overflow-hidden">
          <div class="flex-1 flex flex-col gap-2">
            <div v-if="images && images.length" class="flex flex-wrap gap-1.5">
              <div v-for="(url, i) in images" :key="i" :style="imageContainerStyle(url)"
                class="rounded-lg border border-zinc-200 overflow-hidden shrink-0">
                <LazyImage :src="url" :preview-list="images" :preview-index="i" object-fit="contain" />
              </div>
            </div>
            <div ref="bubbleRef"
              class="human-bubble flex-1 text-[14px] text-zinc-800 leading-relaxed whitespace-pre-wrap transition-all duration-300 overflow-hidden"
              :style="{ maxHeight: expanded || !hasOverflow ? 'none' : '300px' }">
              <slot />
            </div>
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
          class="rounded-2xl rounded-br-sm bg-zinc-100 px-4 py-3 text-[14px] text-zinc-800 leading-relaxed resize-none outline-none ring-2 ring-zinc-300 focus:ring-zinc-400 transition"
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
import { ref, nextTick, onMounted, watch, reactive } from "vue";
import LazyImage from "@/components/LazyImage.vue";

const props = defineProps<{ content: string; images?: string[] }>();
const emit = defineEmits<{
  (e: "edit", val: string): void;
  (e: "editing", val: boolean): void;
}>();

const editing = ref(false);
const draft = ref("");
const bubbleRef = ref<HTMLElement | null>(null);
const textareaRef = ref<HTMLTextAreaElement | null>(null);
const editWidth = ref("");
const hasOverflow = ref(false);
const expanded = ref(false);

const imageSizes = reactive<Record<string, { w: number; h: number }>>({});

watch(() => props.images, (urls) => {
  if (!urls) return;
  for (const url of urls) {
    if (imageSizes[url]) continue;
    const img = new Image();
    img.onload = () => { imageSizes[url] = { w: img.naturalWidth, h: img.naturalHeight }; };
    img.src = url;
  }
}, { immediate: true });

function imageContainerStyle(url: string) {
  const MAX = 200;
  const size = imageSizes[url];
  if (!size) return { width: '80px', height: '80px' };
  const { w, h } = size;
  const ratio = w >= h ? Math.min(1, MAX / w) : Math.min(1, MAX / h);
  return { width: `${Math.round(w * ratio)}px`, height: `${Math.round(h * ratio)}px` };
}

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
  editWidth.value = "min(400px, 80vw)";
  draft.value = props.content;
  editing.value = true;
  emit("editing", true)
  nextTick(() => {
    textareaRef.value?.focus();
    // textareaRef.value?.select();
  });
}

function save() {
  if (draft.value.trim()) {
    emit("edit", draft.value.trim());
  }
  editing.value = false;
  emit("editing", false);
}

function cancel() {
  editing.value = false;
  emit("editing", false);
}

defineExpose({ startEdit });
</script>


<style scoped>
:deep(.human-bubble p) {
  margin-bottom: 0 !important
}
</style>