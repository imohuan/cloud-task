<template>
  <div class="fixed right-6 bottom-6 z-[100] flex flex-col gap-2">
    <TransitionGroup
      enter-active-class="transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
      enter-from-class="opacity-0 translate-y-4 scale-95"
      enter-to-class="opacity-100 translate-y-0 scale-100"
      leave-active-class="transition-all duration-200 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-90"
    >
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="group flex min-w-[280px] items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-lg"
      >
        <component :is="getIcon(toast.type)" class="h-[18px] w-[18px] shrink-0" :class="getIconColorClass(toast.type)" />
        <span class="flex-1 text-xs font-medium text-gray-800">{{ toast.message }}</span>
        <button
          class="text-gray-400 opacity-0 transition-opacity group-hover:opacity-100 hover:text-gray-600"
          @click="$emit('remove', toast.id)"
        >
          <CloseFilled class="h-3.5 w-3.5" />
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

const getIconColorClass = (type: ToastItem["type"]) => {
  switch (type) {
    case "success":
      return "text-emerald-500";
    case "error":
      return "text-red-500";
    case "warning":
      return "text-amber-500";
    default:
      return "text-blue-500";
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
