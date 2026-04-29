import { useToastStore } from "@/stores/useToastStore";

export function useToast() {
  const store = useToastStore();

  function showToast(message: string, type: "success" | "error" | "warning" | "info" = "info") {
    store.show(message, type);
  }

  return { toasts: store.toasts, showToast };
}
