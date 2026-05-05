<template>
  <div v-if="visible" class="image-viewer-overlay" @click.self="close">
    <button class="viewer-close-btn" title="关闭 (Esc)" @click="close">
      <CloseFilled class="h-5 w-5" />
    </button>

    <div class="viewer-container">
      <button v-if="isMultiple" class="viewer-nav-btn viewer-prev" title="上一张 (←)" @click="prevImage">
        <ChevronLeftFilled class="h-5 w-5" />
      </button>

      <div class="viewer-image-wrapper" ref="wrapperRef" @wheel="handleWheel">
        <img v-if="currentImage" :src="currentImage" class="viewer-image"
          :class="{ 'no-transition': isDragging, 'fade-in': isImageLoading }" :style="imageStyle" draggable="false"
          @load="onImageLoad" />
      </div>

      <button v-if="isMultiple" class="viewer-nav-btn viewer-next" title="下一张 (→)" @click="nextImage">
        <ChevronRightFilled class="h-5 w-5" />
      </button>
    </div>

    <div class="viewer-controls">
      <div class="viewer-controls-inner">
        <template v-if="isMultiple">
          <span class="viewer-page-indicator truncate font-mono">{{ currentIndex + 1 }} / {{ images.length }}</span>
          <div class="viewer-divider" />
        </template>

        <div class="viewer-zoom-controls">
          <button title="缩小 (-)" @click="zoomOut">
            <ZoomOutFilled class="h-4 w-4" />
          </button>
          <span class="viewer-zoom-level font-mono">{{ Math.round(scale * 100) }}%</span>
          <button title="放大 (+)" @click="zoomIn">
            <ZoomInFilled class="h-4 w-4" />
          </button>
        </div>

        <div class="viewer-divider" />

        <button title="旋转 (R)" @click="rotate">
          <RotateRightFilled class="h-4 w-4" />
        </button>
        <button title="翻转 (F)" @click="toggleFlip">
          <SwapHorizFilled class="h-4 w-4" />
        </button>
        <button class="viewer-reset-btn" title="重置 (0)" @click="reset">
          <UndoFilled class="h-4 w-4" />
        </button>

        <div class="viewer-divider" />

        <button class="viewer-download-btn" title="下载" @click="download">
          <DownloadFilled class="h-4 w-4" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from "vue";
import { useImageViewerTouch } from "@/composables/useImageViewerTouch";
import {
  CloseFilled,
  ChevronLeftFilled,
  ChevronRightFilled,
  ZoomOutFilled,
  ZoomInFilled,
  RotateRightFilled,
  SwapHorizFilled,
  UndoFilled,
  DownloadFilled,
} from "@vicons/material";
import { getProxyImageUrl } from "@/config";

const props = defineProps<{
  images: string[];
  initialIndex?: number;
  visible: boolean;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "update:visible", value: boolean): void;
}>();

const currentIndex = ref(props.initialIndex || 0);
const scale = ref(1);
const rotation = ref(0);
const flip = ref(false);
const offsetX = ref(0);
const offsetY = ref(0);
const isDragging = ref(false);
const dragStartX = ref(0);
const dragStartY = ref(0);
const isImageLoading = ref(false);

const currentImage = computed(() => {
  const image = props.images[currentIndex.value] || ""
  // const separator = props.src.includes("?") ? "&" : "?";
  // return retryKey.value > 0 ? `${props.src}${separator}_retry=${retryKey.value}` : props.src;
  return getProxyImageUrl(image)
});

const isMultiple = computed(() => props.images.length > 1);

const { wrapperRef } = useImageViewerTouch({
  scale,
  offsetX,
  offsetY,
  isDragging,
  isMultiple,
  prevImage: () => prevImage(),
  nextImage: () => nextImage(),
});

void wrapperRef;

const imageStyle = computed(() => {
  const flipScale = flip.value ? -1 : 1;
  return {
    transform: `translate(${offsetX.value}px, ${offsetY.value}px) scale(${scale.value}) rotate(${rotation.value}deg) scaleX(${flipScale})`,
    transition: isDragging.value ? "none" : "transform 0.2s ease",
  };
});

watch(
  () => props.visible,
  (val) => {
    if (val) {
      currentIndex.value = props.initialIndex || 0;
      reset();
      bindKeyboard();
      document.body.style.overflow = "hidden";
    } else {
      unbindKeyboard();
      document.body.style.overflow = "";
    }
  },
);

watch(
  () => props.initialIndex,
  (val) => {
    currentIndex.value = val || 0;
  },
);

onMounted(() => {
  if (props.visible) {
    bindKeyboard();
    document.body.style.overflow = "hidden";
  }
  window.addEventListener("mousedown", startDrag);
  window.addEventListener("mousemove", onDrag);
  window.addEventListener("mouseup", stopDrag);
});

onBeforeUnmount(() => {
  unbindKeyboard();
  window.removeEventListener("mousedown", startDrag);
  window.removeEventListener("mousemove", onDrag);
  window.removeEventListener("mouseup", stopDrag);
  document.body.style.overflow = "";
});

const close = () => {
  emit("update:visible", false);
  emit("close");
};

const prevImage = () => {
  if (!isMultiple.value) return;
  currentIndex.value = (currentIndex.value - 1 + props.images.length) % props.images.length;
  resetTransform();
  isImageLoading.value = true;
};

const nextImage = () => {
  if (!isMultiple.value) return;
  currentIndex.value = (currentIndex.value + 1) % props.images.length;
  resetTransform();
  isImageLoading.value = true;
};

const zoomIn = () => {
  scale.value = Math.min(scale.value + 0.2, 5);
};
const zoomOut = () => {
  scale.value = Math.max(scale.value - 0.2, 0.2);
};
const rotate = () => {
  rotation.value = (rotation.value + 90) % 360;
};
const toggleFlip = () => {
  flip.value = !flip.value;
};
const reset = () => {
  scale.value = 1;
  rotation.value = 0;
  flip.value = false;
  offsetX.value = 0;
  offsetY.value = 0;
};
const resetTransform = () => {
  scale.value = 1;
  rotation.value = 0;
  flip.value = false;
  offsetX.value = 0;
  offsetY.value = 0;
};
const handleWheel = (e: WheelEvent) => {
  e.preventDefault();
  const delta = e.deltaY > 0 ? -0.1 : 0.1;
  scale.value = Math.min(Math.max(scale.value + delta, 0.2), 5);
};
const startDrag = (e: MouseEvent) => {
  const target = e.target as HTMLElement;
  if (!target.closest(".viewer-image-wrapper")) return;
  isDragging.value = true;
  dragStartX.value = e.clientX - offsetX.value;
  dragStartY.value = e.clientY - offsetY.value;
};
const onDrag = (e: MouseEvent) => {
  if (!isDragging.value) return;
  offsetX.value = e.clientX - dragStartX.value;
  offsetY.value = e.clientY - dragStartY.value;
};
const stopDrag = () => {
  isDragging.value = false;
};
const onImageLoad = () => {
  isImageLoading.value = false;
};
const download = async () => {
  if (!currentImage.value) return;
  try {
    const response = await fetch(currentImage.value);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = `image_${currentIndex.value + 1}.jpg`;
    link.click();
    URL.revokeObjectURL(blobUrl);
  } catch {
    const link = document.createElement("a");
    const url = new URL(currentImage.value, window.location.origin);
    url.searchParams.set("download", "true");
    link.href = url.toString();
    link.download = `image_${currentIndex.value + 1}.jpg`;
    link.target = "_blank";
    link.click();
  }
};

const handleKeydown = (e: KeyboardEvent) => {
  switch (e.key) {
    case "Escape":
      close();
      break;
    case "ArrowLeft":
    case "a":
    case "A":
      if (isMultiple.value) prevImage();
      break;
    case "ArrowRight":
    case "d":
    case "D":
      if (isMultiple.value) nextImage();
      break;
    case "+":
    case "=":
      zoomIn();
      break;
    case "-":
      zoomOut();
      break;
    case "0":
      reset();
      break;
    case "r":
    case "R":
      rotate();
      break;
    case "f":
    case "F":
      toggleFlip();
      break;
  }
};

const bindKeyboard = () => {
  document.addEventListener("keydown", handleKeydown);
};
const unbindKeyboard = () => {
  document.removeEventListener("keydown", handleKeydown);
};
</script>

<style scoped>
.image-viewer-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.95);
  user-select: none;
}

.viewer-close-btn {
  position: fixed;
  top: 24px;
  right: 24px;
  z-index: 10000;
  width: 40px;
  height: 40px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: white;
  cursor: pointer;
  backdrop-filter: blur(10px);
  transition: all 0.2s ease;
}

.viewer-close-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.viewer-container {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.viewer-nav-btn {
  position: absolute;
  z-index: 40;
  width: 44px;
  height: 44px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.05);
  border: none;
  border-radius: 8px;
  color: white;
  cursor: pointer;
  backdrop-filter: blur(4px);
  transition: all 0.2s ease;
}

.viewer-nav-btn:hover {
  background: rgba(255, 255, 255, 0.15);
}

.viewer-prev {
  left: 16px;
}

.viewer-next {
  right: 16px;
}

.viewer-image-wrapper {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  cursor: grab;
  touch-action: none;
}

.viewer-image-wrapper:active {
  cursor: grabbing;
}

.viewer-image {
  max-height: 100vh;
  max-width: 100%;
  object-fit: contain;
  pointer-events: none;
  will-change: transform;
}

.viewer-image.fade-in {
  animation: viewer-fade-in 0.3s ease-in-out;
}

.viewer-image.no-transition {
  transition: none !important;
}

@keyframes viewer-fade-in {
  from {
    opacity: 0;
  }

  to {
    opacity: 1;
  }
}

.viewer-controls {
  position: absolute;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 50;
}

.viewer-controls-inner {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 16px;
  background: rgba(24, 24, 27, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  backdrop-filter: blur(20px);
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3);
}

.viewer-page-indicator {
  font-size: 12px;
  font-weight: bold;
  color: #71717a;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  padding: 0 8px;
}

.viewer-divider {
  width: 1px;
  height: 16px;
  background: rgba(255, 255, 255, 0.1);
  margin: 0 4px;
}

.viewer-zoom-controls {
  display: flex;
  align-items: center;
  gap: 4px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  padding: 2px 6px;
}

.viewer-zoom-level {
  min-width: 48px;
  text-align: center;
  font-size: 12px;
  color: white;
}

.viewer-controls-inner button {
  width: 32px;
  height: 32px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: white;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s ease;
}

.viewer-controls-inner button:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #60a5fa;
}

.viewer-controls-inner .viewer-reset-btn:hover {
  color: #fb923c;
}

.viewer-controls-inner .viewer-download-btn:hover {
  color: #60a5fa;
}
</style>
