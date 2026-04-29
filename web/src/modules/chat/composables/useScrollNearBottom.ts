import { ref, onMounted, onUnmounted } from "vue";
import type { Ref } from "vue";

export function useScrollNearBottom(containerRef: Ref<HTMLElement | null>, threshold = 100) {
  const isNearBottom = ref(true);
  let enabled = true;

  function check() {
    if (!enabled) return;
    const el = containerRef.value;
    if (!el) return;
    isNearBottom.value = el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
  }

  function enable() {
    enabled = true;
    check();
  }

  function disable() {
    enabled = false;
  }

  onMounted(() => {
    const el = containerRef.value;
    if (!el) return;
    el.addEventListener("scroll", check, { passive: true });
    check();
    onUnmounted(() => {
      el.removeEventListener("scroll", check);
    });
  });

  return { isNearBottom, enable, disable };
}
