import { ref, type Ref, type ComputedRef } from "vue";

/** 日志滚动管理 */
export function useLogScroll(options: {
  autoScroll: Ref<boolean>;
  containerRef: Ref<HTMLElement | null> | ComputedRef<HTMLElement | null>;
}) {
  const { autoScroll, containerRef } = options;
  const isUserNearBottom = ref(true);
  const SCROLL_THRESHOLD = 400;

  /** 滚动到底部 */
  function scrollToBottom() {
    if (!containerRef.value) return;
    containerRef.value.scrollTo({
      top: containerRef.value.scrollHeight + 10000,
      behavior: "smooth",
    });
  }

  /** 检查是否接近底部 */
  function checkIfNearBottom() {
    if (!containerRef.value) return true;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.value;
    const distanceToBottom = scrollHeight - scrollTop - clientHeight;
    isUserNearBottom.value = distanceToBottom <= SCROLL_THRESHOLD;
    return isUserNearBottom.value;
  }

  /** 滚动事件处理 */
  function handleScroll() {
    checkIfNearBottom();
  }

  /** 智能滚动：仅在开启自动滚动且用户接近底部时自动滚动 */
  function smartScroll() {
    if (autoScroll.value && isUserNearBottom.value) {
      scrollToBottom();
    }
  }

  return { isUserNearBottom, scrollToBottom, checkIfNearBottom, handleScroll, smartScroll };
}
