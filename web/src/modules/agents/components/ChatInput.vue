<template>
  <div class="font-sans">
    <!-- Main input box -->
    <div class="bg-zinc-50 border border-zinc-200 rounded-2xl px-4 pt-3.5 pb-3 transition-all duration-200 cursor-text relative"
      :class="[
        focused ? 'bg-white border-zinc-300 shadow-sm' : '',
        isDragging ? 'border-blue-400 bg-blue-50/50' : ''
      ]"
      @click="textareaRef?.focus()"
      @dragover.prevent="onDragOver"
      @dragleave="onDragLeave"
      @drop.prevent="onDrop">
      <!-- Drag overlay -->
      <div v-if="isDragging"
        class="absolute inset-0 rounded-2xl border-2 border-dashed border-blue-400 bg-blue-50/60 flex items-center justify-center pointer-events-none z-10">
        <div class="flex flex-col items-center gap-1 text-blue-500">
          <svg class="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
          <span class="text-[12px] font-medium">释放以添加图片</span>
        </div>
      </div>
      <!-- Task Queue -->
      <div v-if="queue && queue.size > 0" class="mb-2 pb-2 border-b border-zinc-100">
        <TaskQueueView :queue="(queue as any)" />
      </div>

      <!-- Image previews -->
      <div v-if="images.length" class="flex flex-wrap gap-2 mb-2.5">
        <div v-for="(img, i) in images" :key="i" class="relative group/img w-9 h-9">
          <LazyImage :src="img.url" :alt="img.name" :preview-list="images.map(x => x.url)" :preview-index="i"
            object-fit="cover" class="rounded-lg border border-zinc-200 overflow-hidden" />
          <!-- Remove -->
          <button
            class="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-white shadow flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity hover:bg-zinc-50"
            @click="removeImage(i)">
            <svg class="w-2.5 h-2.5 text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              stroke-width="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <!-- Filename tooltip -->
          <div
            class="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] text-white bg-black/70 px-1.5 py-px rounded whitespace-nowrap opacity-0 group-hover/img:opacity-100 transition-opacity pointer-events-none max-w-[100px] truncate">
            {{ img.name }}
          </div>
        </div>
      </div>

      <!-- Textarea -->
      <textarea ref="textareaRef" v-model="text" :placeholder="placeholder" rows="3"
        class="w-full bg-transparent border-none outline-none resize-none text-[14px] text-zinc-900 placeholder-zinc-400 leading-relaxed p-0"
        style="min-height: 60px; max-height: 200px; overflow-y: auto;" @input="autoResize" @focus="focused = true" @blur="focused = false"
        @keydown.enter.exact.prevent="trySend" @paste="onPaste" />

      <!-- Bottom row -->
      <div class="flex items-center justify-between pt-2.5">
        <!-- + attach + assistant selector -->
        <div class="flex items-center gap-1">
          <label
            class="w-7 h-7 rounded-full flex items-center justify-center text-zinc-500 hover:bg-zinc-200 cursor-pointer transition-colors shrink-0">
            <input ref="fileRef" type="file" hidden accept="image/*" multiple @change="onFileChange" />
            <svg class="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
              stroke-linecap="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </label>

          <!-- Assistant selector -->
          <Dropdown v-if="assistants && assistants.length" v-model:is-open="assistantDropdownOpen"
            placement="top-start">
            <template #trigger>
              <button
                class="flex items-center gap-1 px-2.5 py-1 rounded-xl font-medium text-zinc-600 hover:bg-zinc-200 transition-colors min-w-0"
                :class="isMobile ? 'text-[11px]' : 'text-[13px]'">
                <span class="truncate" :class="isMobile ? 'max-w-[60px]' : 'max-w-[100px]'">{{ currentAssistantName }}</span>
                <svg class="w-3.5 h-3.5 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  stroke-width="2.5" stroke-linecap="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
            </template>
            <div class="py-1.5 min-w-[180px]">
              <div class="px-3 py-1.5 text-[11px] text-zinc-400 font-medium border-b border-zinc-100 mb-1">选择助手</div>
              <button v-for="a in assistants" :key="a.id"
                class="w-full flex items-center gap-2 px-3 py-2 hover:bg-zinc-50 transition-colors text-left"
                @click="selectAssistant(a.id)">
                <div class="flex-1 min-w-0">
                  <div class="text-[13px] font-medium text-zinc-800 leading-none mb-0.5">{{ a.name }}</div>
                  <div v-if="a.description" class="text-[11px] text-zinc-400 leading-tight truncate max-w-[140px]">{{
                    a.description
                  }}</div>
                </div>
                <div class="w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition-all duration-150"
                  :class="selectedAssistant === a.id ? 'bg-blue-600 opacity-100' : 'opacity-0'">
                  <svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"
                    stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
              </button>
            </div>
          </Dropdown>
        </div>

        <!-- Right: model selector + send -->
        <div class="flex items-center gap-2.5">
          <!-- Model selector -->
          <Dropdown v-if="models.length" v-model:is-open="dropdownOpen" placement="top-end">
            <template #trigger>
              <button
                class="flex items-center gap-1 px-2.5 py-1 rounded-xl font-medium text-zinc-700 hover:bg-zinc-200 transition-colors min-w-0"
                :class="isMobile ? 'text-[11px]' : 'text-[13px]'">
                <span class="truncate" :class="isMobile ? 'max-w-[80px]' : 'max-w-[140px]'">{{ currentModelName }}</span>
                <svg class="w-3.5 h-3.5 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  stroke-width="2.5" stroke-linecap="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
            </template>
            <div class="py-1.5 min-w-[220px]">
              <div class="px-3 py-1.5 text-[11px] text-zinc-400 font-medium border-b border-zinc-100 mb-1">{{
                dropdownTitle }}</div>
              <button v-for="m in models" :key="m.id"
                class="w-full flex items-center gap-2 px-3 py-2 hover:bg-zinc-50 transition-colors text-left"
                @click="selectModel(m.id)">
                <div class="flex-1 min-w-0">
                  <div class="text-[13px] font-medium text-zinc-800 leading-none mb-0.5">{{ m.name || formatModelName(m.id) }}</div>
                  <div class="text-[11px] text-zinc-400 leading-tight">{{ m.desc }}</div>
                </div>
                <div class="w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition-all duration-150"
                  :class="selectedModel === m.id ? 'bg-blue-600 opacity-100' : 'opacity-0'">
                  <svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"
                    stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
              </button>
            </div>
          </Dropdown>


          <!-- Send / Stop -->
          <button class="w-7 h-7 rounded-full flex items-center justify-center transition-colors shrink-0"
            :class="props.isLoading || canSend ? 'bg-zinc-900 text-white hover:bg-zinc-700' : 'bg-zinc-200 text-zinc-400'"
            :disabled="!props.isLoading && !canSend"
            @click="props.isLoading ? emit('stop') : trySend()">
            <StopSharp v-if="props.isLoading" class="w-3.5 h-3.5" />
            <ArrowUpwardSharp v-else class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { storeToRefs } from "pinia";
import LazyImage from "@/components/LazyImage.vue";
import Dropdown from "@/components/dropdown/Dropdown.vue";
import { StopSharp, ArrowUpwardSharp } from "@vicons/material";
import { useStreamContextOptional } from "../composables/useStreamContext";
import TaskQueueView from "./TaskQueueView.vue";
import { useAppStore } from "@/stores/useAppStore";
import { formatModelName } from "@/utils/model";

export interface ChatModel {
  id: string;
  name: string;
  desc?: string;
}

export interface ChatImage {
  file: File;
  url: string;
  name: string;
}

export interface ChatAssistant {
  id: string;
  name: string;
  description?: string;
}

const props = withDefaults(defineProps<{
  placeholder?: string;
  models?: ChatModel[];
  modelId?: string;
  assistants?: ChatAssistant[];
  assistantId?: string;
  dropdownTitle?: string;
  isLoading?: boolean;
}>(), {
  placeholder: "问问大模型",
  models: () => [],
  assistants: () => [],
  dropdownTitle: "选择模型",
});

const emit = defineEmits<{
  send: [text: string, images: ChatImage[]];
  stop: [];
  "update:modelId": [id: string];
  "update:assistantId": [id: string];
}>();

const { isMobile } = storeToRefs(useAppStore());
const streamCtx = useStreamContextOptional();
const queue = computed(() => streamCtx?.queue?.value ?? undefined);

const text = ref("");
const images = ref<ChatImage[]>([]);
const focused = ref(false);
const isDragging = ref(false);
const dropdownOpen = ref(false);
const assistantDropdownOpen = ref(false);
const selectedModel = ref(props.modelId ?? props.models[0]?.id ?? "");
const selectedAssistant = ref(props.assistantId ?? props.assistants?.[0]?.id ?? "");
const textareaRef = ref<HTMLTextAreaElement | null>(null);

const canSend = computed(() => text.value.trim().length > 0);
const currentModelName = computed(
  () => {
    const name = props.models.find((m) => m.id === selectedModel.value)?.name;
    return name || formatModelName(selectedModel.value);
  },
);
const currentAssistantName = computed(
  () => props.assistants?.find((a) => a.id === selectedAssistant.value)?.name ?? selectedAssistant.value,
);

function autoResize() {
  const el = textareaRef.value;
  if (!el) return;
  el.style.height = "auto";
  el.style.height = Math.max(60, Math.min(el.scrollHeight, 200)) + "px";
}

function selectModel(id: string) {
  selectedModel.value = id;
  emit("update:modelId", id);
  dropdownOpen.value = false;
}

function selectAssistant(id: string) {
  selectedAssistant.value = id;
  emit("update:assistantId", id);
  assistantDropdownOpen.value = false;
}

watch(
  () => props.modelId,
  (id) => {
    if (id && id !== selectedModel.value) {
      selectedModel.value = id;
    }
  },
);

watch(
  () => props.assistants,
  (list) => {
    if (list && list.length && !selectedAssistant.value) {
      selectAssistant(list[0]!.id);
    }
  },
  { immediate: true },
);


function trySend() {
  if (!canSend.value) return;
  emit("send", text.value.trim(), [...images.value]);
  text.value = "";
  images.value = [];
  if (textareaRef.value) textareaRef.value.style.height = "60px";
}

function addImageFile(file: File) {
  if (!file.type.startsWith("image/")) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const url = e.target?.result as string;
    if (url) images.value.push({ file, url, name: file.name });
  };
  reader.readAsDataURL(file);
}

function removeImage(i: number) {
  images.value.splice(i, 1);
}

function onFileChange(e: Event) {
  const files = (e.target as HTMLInputElement).files;
  if (!files) return;
  for (const f of files) addImageFile(f);
  (e.target as HTMLInputElement).value = "";
}

function onDragOver() {
  isDragging.value = true;
}

function onDragLeave(e: DragEvent) {
  const el = (e.currentTarget as HTMLElement);
  if (el && el.contains(e.relatedTarget as Node)) return;
  isDragging.value = false;
}

async function addImageUrl(url: string) {
  const fileName = decodeURIComponent(url.split('/').pop()?.split('?')[0] || 'image.png');
  const extMap: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml' };
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const blob = await resp.blob();
    const mimeType = blob.type.startsWith('image/') ? blob.type : (extMap[ext] ?? 'image/png');
    const file = new File([blob], fileName, { type: mimeType });
    addImageFile(file);
  } catch {
    images.value.push({ file: null as any, url, name: fileName });
  }
}

function onDrop(e: DragEvent) {
  isDragging.value = false;
  const dt = e.dataTransfer;
  if (!dt) return;

  // Case 1: file system drop
  const fileItems = Array.from(dt.items ?? []).filter(i => i.kind === 'file');
  if (fileItems.length > 0) {
    for (const item of fileItems) {
      const f = item.getAsFile();
      if (f) addImageFile(f);
    }
    return;
  }

  // Case 2: browser-internal image drag — extract URL
  let imageUrl = '';
  const uriList = dt.getData('text/uri-list');
  if (uriList) imageUrl = uriList.split('\n').find(l => !l.startsWith('#'))?.trim() ?? '';
  if (!imageUrl) {
    const html = dt.getData('text/html');
    const m = html?.match(/src=["']([^"']+)["']/i);
    if (m?.[1]) imageUrl = m[1];
  }
  if (!imageUrl) {
    const plain = dt.getData('text/plain');
    if (/^https?:\/\//i.test(plain)) imageUrl = plain.trim();
  }
  if (imageUrl) addImageUrl(imageUrl);
}

function onPaste(e: ClipboardEvent) {
  for (const item of Array.from(e.clipboardData?.items ?? [])) {
    if (item.type.startsWith("image/")) {
      const f = item.getAsFile();
      if (f) addImageFile(f);
    }
  }
}

</script>
