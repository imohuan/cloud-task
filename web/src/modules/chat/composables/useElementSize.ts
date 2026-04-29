import { ref, onMounted, onUnmounted } from "vue";
import type { Ref } from "vue";

export function useElementSize(targetRef: Ref<HTMLElement | null>) {
  const width = ref(0);
  const height = ref(0);
  let observer: ResizeObserver | null = null;

  const updateSize = () => {
    const el = targetRef.value;
    if (!el) return;
    width.value = el.clientWidth;
    height.value = el.clientHeight;
  };

  onMounted(() => {
    updateSize();
    observer = new ResizeObserver(() => {
      updateSize();
    });
    const el = targetRef.value;
    if (el) {
      observer.observe(el);
    }
  });

  onUnmounted(() => {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
  });

  return { width, height };
}
