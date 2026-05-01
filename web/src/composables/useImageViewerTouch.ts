import { ref, onMounted, onBeforeUnmount } from "vue";
import type { Ref, ComputedRef } from "vue";

interface UseImageViewerTouchOptions {
  scale: Ref<number>;
  offsetX: Ref<number>;
  offsetY: Ref<number>;
  isDragging: Ref<boolean>;
  isMultiple: ComputedRef<boolean>;
  prevImage: () => void;
  nextImage: () => void;
}

export function useImageViewerTouch(options: UseImageViewerTouchOptions) {
  const { scale, offsetX, offsetY, isDragging, isMultiple, prevImage, nextImage } = options;

  const wrapperRef = ref<HTMLElement | null>(null);

  const touchType = ref<"none" | "single" | "pinch">("none");
  const touchStartX = ref(0);
  const touchStartY = ref(0);
  const touchStartOffsetX = ref(0);
  const touchStartOffsetY = ref(0);
  const pinchStartDistance = ref(0);
  const pinchStartScale = ref(0);
  const pinchMidX = ref(0);
  const pinchMidY = ref(0);
  const pinchStartOffsetX = ref(0);
  const pinchStartOffsetY = ref(0);

  const getTouchDistance = (t1: Touch, t2: Touch) => {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const onTouchStart = (e: TouchEvent) => {
    const t0 = e.touches[0] as Touch | undefined;
    const t1 = e.touches[1] as Touch | undefined;
    if (e.touches.length === 1 && t0) {
      touchType.value = "single";
      touchStartX.value = t0.clientX;
      touchStartY.value = t0.clientY;
      touchStartOffsetX.value = offsetX.value;
      touchStartOffsetY.value = offsetY.value;
    } else if (e.touches.length === 2 && t0 && t1) {
      e.preventDefault();
      touchType.value = "pinch";
      pinchStartDistance.value = getTouchDistance(t0, t1);
      pinchStartScale.value = scale.value;
      pinchMidX.value = (t0.clientX + t1.clientX) / 2;
      pinchMidY.value = (t0.clientY + t1.clientY) / 2;
      pinchStartOffsetX.value = offsetX.value;
      pinchStartOffsetY.value = offsetY.value;
    }
  };

  const onTouchMove = (e: TouchEvent) => {
    e.preventDefault();
    const t0 = e.touches[0] as Touch | undefined;
    const t1 = e.touches[1] as Touch | undefined;
    if (touchType.value === "single" && e.touches.length === 1 && t0) {
      offsetX.value = touchStartOffsetX.value + (t0.clientX - touchStartX.value);
      offsetY.value = touchStartOffsetY.value + (t0.clientY - touchStartY.value);
      isDragging.value = true;
    } else if (touchType.value === "pinch" && e.touches.length === 2 && t0 && t1) {
      const currentDistance = getTouchDistance(t0, t1);
      const newScale = Math.min(Math.max(pinchStartScale.value * (currentDistance / pinchStartDistance.value), 0.2), 5);
      const currentMidX = (t0.clientX + t1.clientX) / 2;
      const currentMidY = (t0.clientY + t1.clientY) / 2;
      const containerCX = window.innerWidth / 2;
      const containerCY = window.innerHeight / 2;
      const imgX = (pinchMidX.value - containerCX - pinchStartOffsetX.value) / pinchStartScale.value;
      const imgY = (pinchMidY.value - containerCY - pinchStartOffsetY.value) / pinchStartScale.value;
      scale.value = newScale;
      offsetX.value = currentMidX - containerCX - imgX * newScale;
      offsetY.value = currentMidY - containerCY - imgY * newScale;
      isDragging.value = true;
    }
  };

  const onTouchEnd = (e: TouchEvent) => {
    const changed = e.changedTouches[0] as Touch | undefined;
    if (touchType.value === "single" && changed) {
      const dx = changed.clientX - touchStartX.value;
      const dy = changed.clientY - touchStartY.value;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 50 && Math.abs(dx) > Math.abs(dy) * 1.5 && isMultiple.value && scale.value <= 1.1) {
        if (dx < 0) nextImage();
        else prevImage();
      }
    }
    if (e.touches.length === 0) {
      touchType.value = "none";
      isDragging.value = false;
    } else {
      const remaining = e.touches[0] as Touch | undefined;
      if (remaining) {
        touchType.value = "single";
        touchStartX.value = remaining.clientX;
        touchStartY.value = remaining.clientY;
        touchStartOffsetX.value = offsetX.value;
        touchStartOffsetY.value = offsetY.value;
      }
    }
  };

  onMounted(() => {
    if (wrapperRef.value) {
      wrapperRef.value.addEventListener("touchstart", onTouchStart, { passive: false });
      wrapperRef.value.addEventListener("touchmove", onTouchMove, { passive: false });
      wrapperRef.value.addEventListener("touchend", onTouchEnd, { passive: false });
    }
  });

  onBeforeUnmount(() => {
    if (wrapperRef.value) {
      wrapperRef.value.removeEventListener("touchstart", onTouchStart);
      wrapperRef.value.removeEventListener("touchmove", onTouchMove);
      wrapperRef.value.removeEventListener("touchend", onTouchEnd);
    }
  });

  return { wrapperRef };
}
