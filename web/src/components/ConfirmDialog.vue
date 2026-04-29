<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-all duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-all duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="modelValue" class="fixed inset-0 z-50 flex items-center justify-center">
        <div class="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" @click="handleCancel" />
        <Transition
          enter-active-class="transition-all duration-200 ease-out"
          enter-from-class="opacity-0 scale-95 -translate-y-2"
          enter-to-class="opacity-100 scale-100 translate-y-0"
          leave-active-class="transition-all duration-150 ease-in"
          leave-from-class="opacity-100 scale-100 translate-y-0"
          leave-to-class="opacity-0 scale-95 -translate-y-2"
        >
          <div
            v-if="modelValue"
            class="relative mx-4 w-full max-w-md overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-2xl"
          >
            <div class="flex items-start gap-4 px-6 py-6">
              <div class="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl" :class="iconBgClass">
                <component :is="iconComponent" class="h-6 w-6" :class="iconColorClass" />
              </div>
              <div class="min-w-0 flex-1 pt-0.5">
                <h3 class="text-base font-bold text-slate-800">{{ title }}</h3>
                <p v-if="content" class="mt-1.5 text-sm leading-relaxed text-slate-500">{{ content }}</p>
                <slot name="content" />
              </div>
            </div>
            <div class="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50/30 px-6 py-4">
              <button
                class="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50"
                :disabled="loading"
                @click="handleCancel"
              >
                {{ cancelText }}
              </button>
              <button
                class="flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-medium shadow-sm transition-colors disabled:opacity-50"
                :class="confirmButtonClass"
                :disabled="loading"
                @click="handleConfirm"
              >
                <RefreshFilled v-if="loading" class="h-3 w-3 animate-spin" />
                {{ confirmText }}
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { WarningAmberFilled, DeleteOutlined, InfoOutlined, CheckCircleOutlined, RefreshFilled } from "@vicons/material";
import type { Component } from "vue";

const props = defineProps<{
  modelValue: boolean;
  title?: string;
  content?: string;
  confirmText?: string;
  cancelText?: string;
  type?: "warning" | "danger" | "info" | "success";
  loading?: boolean;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
  (e: "confirm"): void;
  (e: "cancel"): void;
}>();

const iconMap: Record<"warning" | "danger" | "info" | "success", { icon: Component; bg: string; color: string }> = {
  warning: { icon: WarningAmberFilled, bg: "bg-amber-100", color: "text-amber-600" },
  danger: { icon: DeleteOutlined, bg: "bg-red-100", color: "text-red-600" },
  info: { icon: InfoOutlined, bg: "bg-blue-100", color: "text-blue-600" },
  success: { icon: CheckCircleOutlined, bg: "bg-emerald-100", color: "text-emerald-600" },
};

const buttonMap: Record<string, string> = {
  warning: "bg-amber-500 hover:bg-amber-600 text-white",
  danger: "bg-red-500 hover:bg-red-600 text-white",
  info: "bg-blue-500 hover:bg-blue-600 text-white",
  success: "bg-emerald-500 hover:bg-emerald-600 text-white",
};

const iconComponent = computed(() => {
  return (iconMap[props.type || "warning"] || iconMap.warning).icon;
});

const iconBgClass = computed(() => {
  return (iconMap[props.type || "warning"] || iconMap.warning).bg;
});

const iconColorClass = computed(() => {
  return (iconMap[props.type || "warning"] || iconMap.warning).color;
});

const confirmButtonClass = computed(() => {
  return buttonMap[props.type || "warning"] || buttonMap.warning;
});

const handleConfirm = () => {
  emit("confirm");
};

const handleCancel = () => {
  if (props.loading) return;
  emit("cancel");
  emit("update:modelValue", false);
};
</script>
