import { ref } from "vue";

interface ImageItem {
  id: number;
  url: string;
  rotation: number;
  uploadId?: string | null;
}

interface Config {
  stackRotations?: number[];
  expandedSpacing?: number;
  expandedSpacingPreview?: number;
  stackedOffset?: number;
}

export function useImageStack(config: Config = {}) {
  const defaultConfig = {
    stackRotations: [-15, 8, 18, -12, 15],
    expandedSpacing: 60,
    expandedSpacingPreview: 35,
    stackedOffset: 2,
  };
  const finalConfig = { ...defaultConfig, ...config };
  const images = ref<ImageItem[]>([]);
  const isExpanded = ref(false);
  const hoveredIndex = ref<number | null>(null);
  const isDragging = ref(false);

  function addImage(url: string, uploadId?: string | null): number {
    const rotation = finalConfig.stackRotations[images.value.length % finalConfig.stackRotations.length] ?? 0;
    const id = Date.now() + Math.random();
    images.value.push({ id, url, rotation, uploadId: uploadId ?? null });
    return id;
  }

  function getUploadIds() {
    return images.value.filter((img) => img.uploadId).map((img) => img.uploadId!);
  }

  function removeImage(index: number) {
    images.value.splice(index, 1);
    images.value.forEach((img, i) => {
      img.rotation = finalConfig.stackRotations[i % finalConfig.stackRotations.length] ?? 0;
    });
  }

  function handleMouseEnter() {
    isExpanded.value = true;
  }
  function handleMouseLeave() {
    if (isDragging.value) return;
    isExpanded.value = false;
    hoveredIndex.value = null;
  }

  function handleCardHover(index: number) {
    if (isExpanded.value) hoveredIndex.value = index;
  }
  function handleCardLeave() {
    hoveredIndex.value = null;
  }

  function setDragging(dragging: boolean) {
    isDragging.value = dragging;
    if (!dragging) handleMouseLeave();
  }

  /** 根据图片 id 更新其 url（上传成功后本地预览 → 远程 URL） */
  function updateImageUrl(id: number, newUrl: string, uploadId?: string | null) {
    const img = images.value.find((i) => i.id === id);
    if (img) {
      img.url = newUrl;
      if (uploadId !== undefined) img.uploadId = uploadId;
    }
  }

  function clearImages() {
    images.value = [];
    isExpanded.value = false;
    hoveredIndex.value = null;
  }

  return {
    images,
    isExpanded,
    hoveredIndex,
    isDragging,
    config: finalConfig,
    addImage,
    removeImage,
    updateImageUrl,
    getUploadIds,
    clearImages,
    handleMouseEnter,
    handleMouseLeave,
    handleCardHover,
    handleCardLeave,
    setDragging,
  };
}
