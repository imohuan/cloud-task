<template>
  <div v-if="show" class="fixed inset-0 z-50 overflow-y-auto">
    <div class="fixed inset-0 bg-black/50 transition-opacity" @click="emit('close')" />
    <div class="flex min-h-full items-center justify-center p-4">
      <div
        class="relative w-full transform rounded-sm bg-white shadow-xl transition-all"
        :class="widthClass"
        @click.stop
      >
        <div class="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h3 class="text-sm font-semibold text-gray-900">{{ title }}</h3>
          <button class="text-gray-400 transition-colors hover:text-gray-600" @click="emit('close')">
            <CloseFilled class="h-4 w-4" />
          </button>
        </div>
        <div class="px-4 py-3">
          <slot />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { CloseFilled } from "@vicons/material";

const props = defineProps<{
  show: boolean;
  title?: string;
  width?: "sm" | "md" | "lg" | "xl" | "2xl";
}>();

const emit = defineEmits<{
  (e: "close"): void;
}>();

const widthClass = computed(() => {
  const map: Record<string, string> = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
  };
  return map[props.width || "md"] || "max-w-md";
});
</script>
