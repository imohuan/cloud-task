<template>
  <div class="fixed right-6 bottom-6 z-[100] flex flex-col gap-2">
    <TransitionGroup
      enter-active-class="transition-all duration-300 ease-out"
      enter-from-class="opacity-0 translate-y-5"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition-all duration-200 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-90"
    >
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="group flex min-w-[280px] items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-800 shadow-lg"
        :class="getToastClass(toast.type)"
      >
        <component :is="getIcon(toast.type)" class="h-4 w-4 shrink-0" />
        <span class="flex-1 text-xs font-medium">{{ toast.message }}</span>
        <button
          class="text-slate-400 opacity-0 transition-opacity group-hover:opacity-100 hover:text-slate-600"
          @click="$emit('remove', toast.id)"
        >
          <CloseFilled class="h-3 w-3" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup lang="ts">
import { CheckCircleOutlined, CancelOutlined, WarningAmberFilled, InfoOutlined, CloseFilled } from "@vicons/material";
import type { Component } from "vue";

interface ToastItem {
  id: number;
  message: string;
  type: "success" | "error" | "warning" | "info";
}

defineProps<{
  toasts: ToastItem[];
}>();

defineEmits<{
  (e: "remove", id: number): void;
}>();

const getToastClass = (type: ToastItem["type"]) => {
  switch (type) {
    case "success":
      return "border-l-4 border-l-emerald-500";
    case "error":
      return "border-l-4 border-l-red-500";
    case "warning":
      return "border-l-4 border-l-amber-500";
    default:
      return "border-l-4 border-l-blue-500";
  }
};

const getIcon = (type: ToastItem["type"]): Component => {
  switch (type) {
    case "success":
      return CheckCircleOutlined;
    case "error":
      return CancelOutlined;
    case "warning":
      return WarningAmberFilled;
    default:
      return InfoOutlined;
  }
};
</script>
