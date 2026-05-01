<template>
  <div class="font-sans">
    <!-- Main input box -->
    <div
      class="bg-zinc-50 border border-zinc-200 rounded-2xl px-3.5 pt-3 pb-2.5 transition-all duration-200"
      :class="focused ? 'bg-white border-zinc-300 shadow-sm' : ''"
    >
      <!-- Image previews -->
      <div v-if="images.length" class="flex flex-wrap gap-2 mb-2.5">
        <div
          v-for="(img, i) in images"
          :key="i"
          class="relative group/img w-9 h-9"
        >
          <LazyImage
            :src="img.url"
            :alt="img.name"
            :preview-list="images.map(x => x.url)"
            :preview-index="i"
            object-fit="cover"
            class="rounded-lg border border-zinc-200 overflow-hidden"
          />
          <!-- Remove -->
          <button
            class="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-white shadow flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity hover:bg-zinc-50"
            @click="removeImage(i)"
          >
            <svg class="w-2.5 h-2.5 text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <!-- Filename tooltip -->
          <div class="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] text-white bg-black/70 px-1.5 py-px rounded whitespace-nowrap opacity-0 group-hover/img:opacity-100 transition-opacity pointer-events-none max-w-[100px] truncate">
            {{ img.name }}
          </div>
        </div>
      </div>

      <!-- Textarea -->
      <textarea
        ref="textareaRef"
        v-model="text"
        :placeholder="placeholder"
        rows="1"
        class="w-full bg-transparent border-none outline-none resize-none text-[14px] text-zinc-900 placeholder-zinc-400 leading-relaxed p-0"
        style="max-height: 120px; overflow-y: auto;"
        @input="autoResize"
        @focus="focused = true"
        @blur="focused = false"
        @keydown.enter.exact.prevent="trySend"
        @paste="onPaste"
      />

      <!-- Bottom row -->
      <div class="flex items-center justify-between pt-2">
        <!-- + attach -->
        <label class="w-7 h-7 rounded-full flex items-center justify-center text-zinc-500 hover:bg-zinc-200 cursor-pointer transition-colors shrink-0">
          <input ref="fileRef" type="file" hidden accept="image/*" multiple @change="onFileChange" />
          <svg class="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </label>

        <!-- Right: model selector + send -->
        <div class="flex items-center gap-2.5">
          <!-- Model selector -->
          <Dropdown
            v-if="models.length"
            v-model:is-open="dropdownOpen"
            placement="top-end"
          >
            <template #trigger>
              <button class="flex items-center gap-1 px-2.5 py-1 rounded-xl text-[13px] font-medium text-zinc-700 hover:bg-zinc-200 transition-colors">
                <span>{{ currentModelName }}</span>
                <svg class="w-3.5 h-3.5 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
            </template>
            <div class="py-1.5 min-w-[220px]">
              <div class="px-3 py-1.5 text-[11px] text-zinc-400 font-medium border-b border-zinc-100 mb-1">{{ dropdownTitle }}</div>
              <button
                v-for="m in models"
                :key="m.id"
                class="w-full flex items-center gap-2 px-3 py-2 hover:bg-zinc-50 transition-colors text-left"
                @click="selectModel(m.id)"
              >
                <div class="flex-1 min-w-0">
                  <div class="text-[13px] font-medium text-zinc-800 leading-none mb-0.5">{{ m.name }}</div>
                  <div class="text-[11px] text-zinc-400 leading-tight">{{ m.desc }}</div>
                </div>
                <div
                  class="w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition-all duration-150"
                  :class="selectedModel === m.id ? 'bg-blue-600 opacity-100' : 'opacity-0'"
                >
                  <svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
              </button>
            </div>
          </Dropdown>

          <!-- Send -->
          <button
            class="w-7 h-7 rounded-full flex items-center justify-center transition-colors shrink-0"
            :class="canSend ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-zinc-200 text-zinc-400'"
            :disabled="!canSend"
            @click="trySend"
          >
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import LazyImage from "@/components/LazyImage.vue";
import Dropdown from "@/components/dropdown/Dropdown.vue";

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

const props = withDefaults(defineProps<{
  placeholder?: string;
  models?: ChatModel[];
  modelId?: string;
  dropdownTitle?: string;
}>(), {
  placeholder: "问问大模型",
  models: () => [],
  dropdownTitle: "选择模型",
});

const emit = defineEmits<{
  send: [text: string, images: ChatImage[]];
  "update:modelId": [id: string];
}>();

const text = ref("");
const images = ref<ChatImage[]>([]);
const focused = ref(false);
const dropdownOpen = ref(false);
const selectedModel = ref(props.modelId ?? props.models[0]?.id ?? "");
const textareaRef = ref<HTMLTextAreaElement | null>(null);

const canSend = computed(() => text.value.trim().length > 0);
const currentModelName = computed(
  () => props.models.find((m) => m.id === selectedModel.value)?.name ?? selectedModel.value,
);

function autoResize() {
  const el = textareaRef.value;
  if (!el) return;
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 120) + "px";
}

function selectModel(id: string) {
  selectedModel.value = id;
  emit("update:modelId", id);
  dropdownOpen.value = false;
}


function trySend() {
  if (!canSend.value) return;
  emit("send", text.value.trim(), [...images.value]);
  text.value = "";
  images.value = [];
  if (textareaRef.value) textareaRef.value.style.height = "auto";
}

function addImageFile(file: File) {
  if (!file.type.startsWith("image/")) return;
  const url = URL.createObjectURL(file);
  images.value.push({ file, url, name: file.name });
}

function removeImage(i: number) {
  const img = images.value[i];
  if (img) URL.revokeObjectURL(img.url);
  images.value.splice(i, 1);
}

function onFileChange(e: Event) {
  const files = (e.target as HTMLInputElement).files;
  if (!files) return;
  for (const f of files) addImageFile(f);
  (e.target as HTMLInputElement).value = "";
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

