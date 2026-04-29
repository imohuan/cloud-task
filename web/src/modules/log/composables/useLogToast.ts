import { ref } from "vue";

/** 日志 Toast 通知 */
export function useLogToast() {
  const toasts = ref<Array<{ id: number; message: string; type: "success" | "error" }>>([]);

  function showToast(message: string, type: "success" | "error" = "success") {
    const id = Date.now();
    toasts.value.push({ id, message, type });
    setTimeout(() => {
      toasts.value = toasts.value.filter((t) => t.id !== id);
    }, 3000);
  }

  return { toasts, showToast };
}
