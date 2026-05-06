<template>
  <div
    ref="containerRef"
    :class="['relative shrink-0 transition-all duration-300', previewMode ? 'h-12 w-12' : 'h-20 w-20']"
    @mouseenter="emit('mouseEnter')"
    @touchstart="handleContainerTouchStart"
  >
    <div
      :class="['relative flex items-center', previewMode ? 'h-12 w-auto' : 'h-20 w-auto']"
      @mouseleave="handleContainerMouseLeave"
      @dragenter.prevent="handleDragOver"
      @dragover.prevent="handleDragOver"
      @dragleave.prevent="handleDragLeave"
      @drop.prevent.stop="handleDrop"
    >
      <div
        v-for="(img, index) in images"
        :key="img.id"
        style="position: absolute"
        class="cursor-pointer"
        :style="getCardStyle(index)"
        @mouseenter="emit('cardHover', index)"
        @mouseleave="emit('cardLeave')"
        @touchstart="emit('cardHover', index)"
      >
        <div :class="['absolute -right-2 -left-2 h-10', previewMode ? '-top-2' : '-top-4']"></div>
        <button
          v-if="hoveredIndex === index && isExpanded"
          :class="[
            'absolute -right-2 z-50 flex rounded-full bg-gray-800 p-1 text-white shadow-md transition-all hover:bg-black',
            previewMode ? '-top-1' : '-top-2',
          ]"
          @click.stop="emit('removeImage', index)"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            :width="previewMode ? '10' : '12'"
            :height="previewMode ? '10' : '12'"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
        <div
          :class="[
            'relative overflow-hidden rounded-lg border-2 bg-gray-100 shadow',
            'border-white',
            previewMode ? 'h-12 w-10' : 'h-20 w-16',
          ]"
        >
          <LazyImage :src="img.url" :preview-list="images?.map((i) => i.url) || []" :preview-index="index" />
          <div
            v-if="failedMap[img.url]"
            class="absolute inset-0 z-10 flex cursor-pointer items-center justify-center bg-black/30"
            :title="failedMap[img.url]?.error"
            @click.stop="handleRetryUpload(img.url)"
          >
            <span :class="['flex items-center justify-center rounded-full bg-red-500 shadow-md', previewMode ? 'p-1' : 'p-1.5']">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                :width="previewMode ? '12' : '16'"
                :height="previewMode ? '12' : '16'"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
            </span>
          </div>
        </div>
        <span v-if="pendingUrls.includes(img.url)" class="absolute right-1 bottom-1 z-50 flex h-2.5 w-2.5">
          <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-yellow-400 opacity-75"></span>
          <span class="relative inline-flex h-2.5 w-2.5 rounded-full bg-yellow-500"></span>
        </span>
      </div>
      <div v-if="!isAtMaxImages" style="position: absolute" :style="getAddButtonStyle">
        <div
          :class="[
            'group flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-white transition-all duration-300 hover:bg-gray-50',
            previewMode ? 'h-12 w-10' : 'h-20 w-16',
            { 'is-dragging': isDragging },
          ]"
          @click="triggerUpload"
        >
          <svg
            v-if="!isDragging"
            class="text-gray-400 transition-transform group-hover:scale-125"
            xmlns="http://www.w3.org/2000/svg"
            :width="previewMode ? '16' : '20'"
            :height="previewMode ? '16' : '20'"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M5 12h14" />
            <path d="M12 5v14" />
          </svg>
          <div v-else class="pointer-events-none flex flex-col items-center gap-1">
            <svg
              class="animate-bounce-custom text-blue-500"
              xmlns="http://www.w3.org/2000/svg"
              :width="previewMode ? '20' : '24'"
              :height="previewMode ? '20' : '24'"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" x2="12" y1="15" y2="3" />
            </svg>
            <span v-if="!previewMode" class="text-xs text-blue-500">松开上传</span>
          </div>
        </div>
      </div>
    </div>
    <input ref="fileInputRef" type="file" accept="image/*" :multiple="(props.maxImages ?? 5) > 1" class="hidden" @change="handleFileUpload" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, reactive, onMounted, onUnmounted } from "vue";
import LazyImage from "@/components/LazyImage.vue";
import { useImageUpload } from "@/composables/useImageUpload";
import { useToastStore } from "@/stores";

interface ImageItem {
  id: number;
  url: string;
  rotation: number;
}

const props = defineProps<{
  images?: ImageItem[];
  isExpanded?: boolean;
  hoveredIndex?: number | null;
  maxImages?: number;
  previewMode?: boolean;
}>();

const emit = defineEmits<{
  (e: "addImage", url: string, uploadId: string | null): void;
  (e: "removeImage", index: number): void;
  (e: "mouseEnter"): void;
  (e: "mouseLeave"): void;
  (e: "cardHover", index: number): void;
  (e: "cardLeave"): void;
  (e: "draggingChange", v: boolean): void;
  (e: "imageUploaded", localUrl: string, remoteUrl: string): void;
  (e: "uploadStateChange", isUploading: boolean): void;
}>();

const toastStore = useToastStore();
const showToast = (msg: string) => toastStore.show(msg, "error");

const { uploadFiles, retryUpload, uploadingMap } = useImageUpload({
  onSuccess(key, remoteUrl) {
    // key 即为添加时的 localUrl，用于匹配替换
    emit("imageUploaded", key, remoteUrl);
  },
});

const containerRef = ref<HTMLElement | null>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);
const pendingUrls = ref<string[]>([]);
const failedMap = reactive<Record<string, { file: File; error: string }>>({});
const hasPendingUploads = computed(() => pendingUrls.value.length > 0);
watch(hasPendingUploads, (v) => emit("uploadStateChange", v));
const isAtMaxImages = computed(() => (props.images?.length ?? 0) >= (props.maxImages ?? 5));
const isDragging = ref(false);
let dragCounter = 0;

const isOverBody = ref(false);
let bodyCounter = 0;

function onBodyDragEnter(e: DragEvent) {
  e.preventDefault();
  bodyCounter++;
  if (bodyCounter === 1) isOverBody.value = true;
}
function onBodyDragOver(e: DragEvent) {
  e.preventDefault();
}
function onBodyDragLeave(e: DragEvent) {
  e.preventDefault();
  bodyCounter--;
  if (bodyCounter <= 0) {
    bodyCounter = 0;
    isOverBody.value = false;
  }
}
function onBodyDrop(e: DragEvent) {
  e.preventDefault();
  bodyCounter = 0;
  isOverBody.value = false;
}

function handleContainerTouchStart() {
  emit("mouseEnter");
}

function onDocumentTouchStart(event: TouchEvent) {
  if (containerRef.value && !containerRef.value.contains(event.target as Node)) {
    emit("mouseLeave");
  }
}

onMounted(() => {
  document.body.addEventListener("dragenter", onBodyDragEnter);
  document.body.addEventListener("dragover", onBodyDragOver);
  document.body.addEventListener("dragleave", onBodyDragLeave);
  document.body.addEventListener("drop", onBodyDrop);
  document.addEventListener("touchstart", onDocumentTouchStart, { passive: true });
});
onUnmounted(() => {
  document.body.removeEventListener("dragenter", onBodyDragEnter);
  document.body.removeEventListener("dragover", onBodyDragOver);
  document.body.removeEventListener("dragleave", onBodyDragLeave);
  document.body.removeEventListener("drop", onBodyDrop);
  document.removeEventListener("touchstart", onDocumentTouchStart);
});

watch(isOverBody, (isOver) => {
  if (!isDragging.value) emit("draggingChange", isOver);
  if (isOver) emit("mouseEnter");
});

watch(
  () => props.images,
  (newImages) => {
    const currentUrls = new Set(newImages?.map((i) => i.url) ?? []);
    Object.keys(failedMap).forEach((k) => {
      if (!currentUrls.has(k)) delete failedMap[k];
    });
  },
  { deep: true },
);

watch(
  () => props.images?.length,
  (newLen, oldLen) => {
    if (newLen && oldLen && newLen > (props.maxImages ?? 5)) {
      for (let i = 0; i < newLen - (props.maxImages ?? 5); i++) emit("removeImage", 0);
    }
  },
);

function getCardStyle(index: number) {
  const img = props.images?.[index];
  if (!img) return {};
  const spacing = props.previewMode ? 35 : 60;
  let rotation = img.rotation || [-15, 8, 18, -12, 15][index % 5] || 0;
  if (props.isExpanded) {
    const scale = props.hoveredIndex === index ? 1.1 : 1;
    const displayRotation = props.hoveredIndex === index ? 0 : rotation;
    return {
      transform: `translateX(${index * spacing}px) rotate(${displayRotation}deg) scale(${scale})`,
      transformOrigin: "center center",
      left: "0px",
      zIndex: props.hoveredIndex === index ? 100 : 10 + index,
      transition: "transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), left 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
    };
  }
  const totalImages = props.images?.length ?? 0;
  if (totalImages === 1) rotation = 0;
  else rotation = -15 + (index / (totalImages - 1)) * 30;
  rotation = img.rotation;
  return {
    transform: `rotate(${rotation}deg) scale(1)`,
    transformOrigin: "center center",
    left: "10px",
    zIndex: 10 + index,
    transition: "transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), left 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
  };
}

const getAddButtonStyle = computed(() => {
  const index = props.images?.length ?? 0;
  const spacing = props.previewMode ? 35 : 60;
  if (props.isExpanded) {
    return {
      transform: `translateX(${index * spacing}px) rotate(-8deg) scale(1.1)`,
      left: index === 0 ? "10px" : "0px",
      opacity: "1",
      zIndex: "10",
      transition:
        "transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), left 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
    };
  }
  if (index > 0) {
    return {
      transform: "rotate(-8deg)",
      left: "10px",
      opacity: "0.8",
      zIndex: "5",
      transition:
        "transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), left 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
    };
  }
  return {
    transform: "rotate(-8deg)",
    left: "10px",
    opacity: "0.8",
    zIndex: "10",
    transition:
      "transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), left 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
  };
});

function waitForUploads(): Promise<void> {
  if (!hasPendingUploads.value) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const stop = watch(hasPendingUploads, (pending) => {
      if (!pending) {
        stop();
        resolve();
      }
    });
  });
}

const MAX_RETRIES = 3;

async function doUploadWithRetry(localUrl: string, file: File): Promise<void> {
  pendingUrls.value = [...pendingUrls.value, localUrl];
  delete failedMap[localUrl];
  try {
    const tasks = await uploadFiles(localUrl, [file]);
    let task = tasks[0];
    if (!task) {
      const errorTask = uploadingMap[localUrl]?.find((t) => t.status === "error");
      const errMsg = errorTask?.error || "图片上传失败";
      showToast(errMsg);
      failedMap[localUrl] = { file, error: errMsg };
      return;
    }
    for (let attempt = 1; task && task.status === "error" && attempt < MAX_RETRIES; attempt++) {
      showToast(`${task.error || "图片上传失败"}，正在重试 (${attempt}/${MAX_RETRIES - 1})...`);
      await new Promise<void>((r) => setTimeout(r, 1500));
      await retryUpload(localUrl, task.id);
      task = uploadingMap[localUrl]?.find((t) => t.id === task!.id) ?? task;
    }
    if (task?.status === "error") {
      const errMsg = task.error || "图片上传失败，请检查网络连接";
      showToast(errMsg);
      failedMap[localUrl] = { file, error: errMsg };
    }
  } finally {
    pendingUrls.value = pendingUrls.value.filter((u) => u !== localUrl);
  }
}

async function handleRetryUpload(localUrl: string) {
  const entry = failedMap[localUrl];
  if (!entry) return;
  await doUploadWithRetry(localUrl, entry.file);
}

function triggerUpload() {
  fileInputRef.value?.click();
}

function handleContainerMouseLeave() {
  if (!isOverBody.value) emit("draggingChange", false);
  emit("mouseLeave");
}

async function handleFileUpload(event: Event) {
  const target = event.target as HTMLInputElement;
  const files = target.files;
  if (!files || files.length === 0) return;
  await processFiles(Array.from(files));
  target.value = "";
}

async function processFiles(files: File[]) {
  const imageFiles = files.filter((f) => f.type.startsWith("image/"));
  if (imageFiles.length === 0) return;

  const maxImages = props.maxImages ?? 5;
  const remaining = maxImages - (props.images?.length ?? 0);
  const filesToProcess = imageFiles.slice(0, Math.max(0, remaining));

  for (const file of filesToProcess) {
    const previewUrl = URL.createObjectURL(file);
    emit("addImage", previewUrl, null);
    doUploadWithRetry(previewUrl, file);
  }
}

function handleDragOver(event: DragEvent) {
  event.preventDefault();
  event.stopPropagation();
  if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
  if (!isDragging.value) {
    isDragging.value = true;
    dragCounter = 1;
  }
}

function handleDragLeave(event: DragEvent) {
  event.preventDefault();
  event.stopPropagation();
  dragCounter--;
  if (dragCounter === 0) isDragging.value = false;
}

async function handleDrop(event: DragEvent) {
  event.preventDefault();
  event.stopPropagation();
  isDragging.value = false;
  dragCounter = 0;
  const dt = event.dataTransfer;
  if (!dt) return;

  if (dt.files && dt.files.length > 0) {
    await processFiles(Array.from(dt.files));
    return;
  }

  const tryFetchAsFile = async (url: string): Promise<boolean> => {
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      if (!blob.type.startsWith("image/")) return false;
      const ext = blob.type.split("/")[1] || "jpg";
      const file = new File([blob], `image.${ext}`, { type: blob.type });
      await processFiles([file]);
      return true;
    } catch {
      return false;
    }
  };

  const uriList = dt.getData("text/uri-list") || dt.getData("URL");
  if (uriList) {
    const url = uriList.split("\n").find((u) => u.trim() && !u.startsWith("#"))?.trim();
    if (url) {
      const ok = await tryFetchAsFile(url);
      if (!ok) emit("addImage", url, null);
      return;
    }
  }

  const html = dt.getData("text/html");
  if (html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const src = doc.querySelector("img")?.src;
    if (src) {
      const ok = await tryFetchAsFile(src);
      if (!ok) emit("addImage", src, null);
    }
  }
}

defineExpose({ hasPendingUploads, waitForUploads, processFiles });
</script>
