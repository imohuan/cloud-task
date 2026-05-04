<template>
  <Teleport to="body">
    <Transition name="b64-modal">
      <div
        v-if="visible"
        class="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
        @click.self="$emit('close')"
      >
        <div class="relative flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
          <!-- Header -->
          <div class="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3">
            <div class="flex items-center gap-2">
              <span class="text-sm font-semibold text-slate-700">
                {{ isImage ? "图片预览" : "Base64 内容" }}
              </span>
              <span class="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-400">{{ content.length }} 字符</span>
              <span v-if="mimeType" class="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-600">{{ mimeType }}</span>
            </div>
            <div class="flex items-center gap-2">
              <button
                @click="copyContent"
                class="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
              >
                <component :is="copied ? DoneRound : ContentCopyRound" class="h-3.5 w-3.5" :class="copied ? 'text-emerald-500' : ''" />
                {{ copied ? "已复制" : "复制" }}
              </button>
              <button
                @click="$emit('close')"
                class="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              >
                <CloseRound class="h-4 w-4" />
              </button>
            </div>
          </div>

          <!-- Content -->
          <div class="flex-1 overflow-auto p-4">
            <!-- Image preview -->
            <div v-if="isImage" class="space-y-4">
              <div class="flex items-center justify-center rounded-lg bg-slate-50 p-4">
                <img :src="imageSrc" class="max-h-64 max-w-full rounded object-contain shadow" alt="base64 image" />
              </div>
              <details class="group">
                <summary class="cursor-pointer select-none text-xs text-slate-400 hover:text-slate-600">查看原始 Base64 数据</summary>
                <pre class="mt-2 overflow-auto rounded bg-slate-50 p-3 text-[11px] text-slate-600 break-all whitespace-pre-wrap">{{ content }}</pre>
              </details>
            </div>

            <!-- Plain text -->
            <pre v-else class="overflow-auto rounded bg-slate-50 p-3 text-[11px] text-slate-600 break-all whitespace-pre-wrap">{{ content }}</pre>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from "vue";
import { ContentCopyRound, DoneRound, CloseRound } from "@vicons/material";

const props = defineProps<{
  visible: boolean;
  content: string;
  mimeType?: string;
}>();

const emit = defineEmits<{
  close: [];
}>();

const copied = ref(false);

const IMAGE_PREFIXES = ["iVBOR", "/9j/", "R0lGOD", "UklGR", "Qk0", "SUk", "AAAB"];

const isImage = computed(() => {
  if (props.mimeType?.startsWith("image/")) return true;
  return IMAGE_PREFIXES.some((p) => props.content.startsWith(p));
});

const imageSrc = computed(() => {
  if (!isImage.value) return "";
  if (props.mimeType) return `data:${props.mimeType};base64,${props.content}`;
  const prefix = props.content.slice(0, 8);
  let mime = "image/png";
  if (prefix.startsWith("/9j/")) mime = "image/jpeg";
  else if (prefix.startsWith("R0lGOD")) mime = "image/gif";
  else if (prefix.startsWith("UklGR")) mime = "image/webp";
  return `data:${mime};base64,${props.content}`;
});

async function copyContent() {
  try {
    await navigator.clipboard.writeText(props.content);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  } catch (e) {
    console.error("复制失败", e);
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape" && props.visible) emit("close");
}

onMounted(() => document.addEventListener("keydown", onKeydown));
onUnmounted(() => document.removeEventListener("keydown", onKeydown));
</script>

<style scoped>
.b64-modal-enter-active,
.b64-modal-leave-active {
  transition: opacity 0.2s ease;
}
.b64-modal-enter-from,
.b64-modal-leave-to {
  opacity: 0;
}
</style>
