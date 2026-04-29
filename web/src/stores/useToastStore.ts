import { defineStore } from "pinia";
import { ref } from "vue";

export const useToastStore = defineStore("toast", () => {
  const toasts = ref<Array<{ id: number; message: string; type: "success" | "error" | "warning" | "info" }>>([]);

  function show(message: string, type: "success" | "error" | "warning" | "info" = "info") {
    const id = Date.now() + Math.random();
    toasts.value.push({ id, message, type });
    setTimeout(() => remove(id), 3000);
  }

  function remove(id: number) {
    toasts.value = toasts.value.filter((t) => t.id !== id);
  }

  return { toasts, show, remove };
});
