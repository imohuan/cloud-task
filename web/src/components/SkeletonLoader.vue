<template>
  <div
    v-for="n in repeat"
    :key="n"
    class="animate-pulse rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
    :style="computedWidth"
    :class="customClass"
  >
    <div v-if="showHeader" class="mb-4 h-4 rounded bg-slate-100" :style="{ width: headerWidth }"></div>
    <div class="space-y-2">
      <div
        v-for="line in lines"
        :key="line"
        class="h-3 rounded bg-slate-50"
        :style="{ width: getLineWidth(line) }"
      ></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    repeat?: number;
    lines?: number;
    showHeader?: boolean;
    headerWidth?: string;
    lineWidths?: string[];
    width?: number | string;
    customClass?: string;
  }>(),
  {
    repeat: 1,
    lines: 3,
    showHeader: false,
    headerWidth: "33%",
    lineWidths: () => ["100%", "83%", "66%"],
  },
);

const computedWidth = computed(() => {
  if (!props.width) return undefined;
  const val = typeof props.width === "number" ? props.width + "px" : props.width;
  return { width: val };
});

function getLineWidth(lineIndex: number): string {
  const widths = props.lineWidths?.length ? props.lineWidths : ["100%", "83%", "66%"];
  return widths[(lineIndex - 1) % widths.length] ?? "100%";
}
</script>
