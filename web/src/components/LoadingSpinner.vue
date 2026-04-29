<template>
  <div class="inline-flex flex-col items-center justify-center gap-2" :class="customClass">
    <div
      class="animate-spin rounded-full border-current border-t-transparent"
      :style="spinnerStyle"
      :class="colorClass"
    ></div>
    <span v-if="text" class="text-sm text-slate-400">{{ text }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    size?: number;
    thickness?: number;
    colorClass?: string;
    text?: string;
    customClass?: string;
  }>(),
  {
    size: 24,
    thickness: 3,
    colorClass: "text-slate-500",
  },
);

const spinnerStyle = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  borderWidth: `${props.thickness}px`,
}));
</script>
