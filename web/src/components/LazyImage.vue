<template>
  <div class="group relative h-full w-full cursor-pointer overflow-hidden bg-gray-100" @click="handleClick">
    <div v-if="loadState === 'loading'"
      class="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
      <RefreshFilled class="mb-1 h-5 w-5 animate-spin" />
      <span class="text-[10px]">{{ loadingText }}</span>
    </div>

    <div v-else-if="loadState === 'error'"
      class="absolute inset-0 flex flex-col items-center justify-center text-red-400 transition-colors hover:bg-red-50">
      <ErrorFilled class="mb-1 h-5 w-5" />
      <span class="text-[10px] font-medium">{{ errorText }}</span>
      <span class="mt-0.5 text-[9px] text-gray-400">{{ retryText }}</span>
    </div>

    <img :src="imageSrc" :alt="alt" class="h-full w-full transition-all duration-300" :class="[
      objectFit === 'cover' ? 'object-cover' : 'object-contain',
      loadState === 'loaded' ? 'opacity-100' : 'opacity-0',
    ]" loading="lazy" @load="handleLoad" @error="handleError" />

    <div v-if="loadState === 'loaded'"
      class="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/30 group-hover:opacity-100">
      <ZoomInFilled
        class="h-5 w-5 scale-75 transform text-white drop-shadow-md transition-transform group-hover:scale-100" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { RefreshFilled, ErrorFilled, ZoomInFilled } from "@vicons/material";
import { createImageViewer } from "@/composables/useImageViewer";
import { API_BASE } from "@/config";

const props = defineProps<{
  src: string;
  alt?: string;
  previewList?: string[] | null;
  previewIndex?: number;
  objectFit?: "cover" | "contain";
  loadingText?: string;
  errorText?: string;
  retryText?: string;
}>();

const emit = defineEmits<{
  (e: "load", event: Event): void;
  (e: "error", event: Event): void;
  (e: "click"): void;
}>();

const imageViewer = createImageViewer();

const loadState = ref<"loading" | "loaded" | "error">("loading");
const retryKey = ref(0);
const baseUrl = `${API_BASE}/upload/proxy?url={{url}}&retries=5&retryDelay=500&timeout=15000&maxRetries=5&maxRetryDelay=2000&minTimeout=2000&maxTimeout=20000&type=resource`

const imageSrc = computed(() => {
  // const separator = props.src.includes("?") ? "&" : "?";
  // return retryKey.value > 0 ? `${props.src}${separator}_retry=${retryKey.value}` : props.src;
  const result = baseUrl.replace("{{url}}", encodeURIComponent(props.src))
  // console.log({ baseUrl, result });
  return result
});

const handleLoad = (e: Event) => {
  loadState.value = "loaded";
  emit("load", e);
};

const handleError = (e: Event) => {
  loadState.value = "error";
  emit("error", e);
};

const handleRetry = () => {
  loadState.value = "loading";
  retryKey.value++;
};

const handlePreview = () => {
  const images = props.previewList || [imageSrc.value];
  const index = props.previewList ? props.previewIndex || 0 : 0;
  imageViewer.open(images, index);
};

const handleClick = () => {
  if (loadState.value === "loaded") {
    handlePreview();
  } else if (loadState.value === "error") {
    handleRetry();
  }
  emit("click");
};
</script>
