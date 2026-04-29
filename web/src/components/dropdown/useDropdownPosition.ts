import { ref, onMounted, onUnmounted } from "vue";

interface Options {
  placement?: string;
  offset?: number;
  isOpen?: { value: boolean };
}

export function useDropdownPosition({ placement = "top-start", offset = 8 }: Options = {}) {
  const triggerRef = ref<HTMLElement | null>(null);
  const dropdownRef = ref<HTMLElement | null>(null);
  const dropdownStyle = ref<Record<string, string>>({});

  function getAncestorScale(el: HTMLElement) {
    let node: HTMLElement | null = el;
    while (node && node !== document.body && node !== document.documentElement) {
      const transform = window.getComputedStyle(node).transform;
      if (transform && transform !== "none") {
        const matrix = new DOMMatrix(transform);
        return { x: matrix.a, y: matrix.d };
      }
      node = node.parentElement;
    }
    return { x: 1, y: 1 };
  }

  function getTransformOrigin(p: string) {
    switch (p) {
      case "bottom-start":
        return "top left";
      case "bottom-end":
        return "top right";
      case "top-start":
        return "bottom left";
      case "top-end":
        return "bottom right";
      default:
        return "top left";
    }
  }

  function updatePosition() {
    if (!triggerRef.value || !dropdownRef.value) return;
    const triggerRect = triggerRef.value.getBoundingClientRect();
    const dropdownRect = dropdownRef.value.getBoundingClientRect();

    if (dropdownRect.width === 0 || dropdownRect.height === 0) {
      requestAnimationFrame(updatePosition);
      return;
    }

    const scale = getAncestorScale(triggerRef.value);
    const sx = scale.x;
    const sy = scale.y;

    let top = 0,
      left = 0;

    switch (placement) {
      case "bottom-start":
        top = triggerRect.bottom + offset;
        left = triggerRect.left;
        break;
      case "bottom-end":
        top = triggerRect.bottom + offset;
        left = triggerRect.right - dropdownRect.width;
        break;
      case "top-start":
        top = triggerRect.top - dropdownRect.height - offset;
        left = triggerRect.left;
        break;
      case "top-end":
        top = triggerRect.top - dropdownRect.height - offset;
        left = triggerRect.right - dropdownRect.width;
        break;
      case "right":
        top = triggerRect.top;
        left = triggerRect.right + offset;
        break;
      case "left":
        top = triggerRect.top;
        left = triggerRect.left - dropdownRect.width - offset;
        break;
    }

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const dWidth = dropdownRect.width * sx;
    const dHeight = dropdownRect.height * sy;
    if (left + dWidth > vw) left = vw - dWidth - 8;
    if (left < 8) left = 8;
    if (top + dHeight > vh) top = vh - dHeight - 8;
    if (top < 8) top = 8;

    const style: Record<string, string> = { top: top + "px", left: left + "px" };
    if (sx !== 1 || sy !== 1) {
      style.transform = `scale(${sx}, ${sy})`;
      style.transformOrigin = getTransformOrigin(placement);
    }
    dropdownStyle.value = style;
  }

  function handleScroll() {
    updatePosition();
  }

  function handleResize() {
    updatePosition();
  }

  onMounted(() => {
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleResize);
  });

  onUnmounted(() => {
    window.removeEventListener("scroll", handleScroll, true);
    window.removeEventListener("resize", handleResize);
  });

  return { triggerRef, dropdownRef, dropdownStyle, updatePosition };
}
