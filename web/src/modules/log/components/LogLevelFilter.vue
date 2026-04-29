<template>
  <div class="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
    <button
      v-for="level in LOG_LEVELS"
      :key="level.value"
      @click="$emit('toggle', level.value)"
      class="rounded px-3 py-1 text-[11px] font-bold tracking-wider uppercase transition-all"
      :class="getLevelButtonClass(level.value)"
    >
      {{ level.label }}
    </button>
  </div>
</template>

<script setup lang="ts">
import type { LogLevel } from "../types";
import { LOG_LEVELS } from "../types";

const props = defineProps<{
  activeLevelFilters: LogLevel[];
}>();

defineEmits<{
  toggle: [level: LogLevel];
}>();

function getLevelButtonClass(level: LogLevel) {
  const isActive = props.activeLevelFilters.includes(level);
  const base = isActive ? "bg-white shadow-sm" : "hover:bg-slate-50";

  switch (level) {
    case "DEBUG":
      return isActive ? `text-slate-600 ${base}` : `text-slate-400 ${base}`;
    case "INFO":
      return isActive ? `text-blue-600 ${base}` : `text-blue-400 ${base}`;
    case "WARN":
      return isActive ? `text-amber-600 ${base}` : `text-amber-500 ${base}`;
    case "ERROR":
      return isActive ? `text-red-600 ${base}` : `text-red-400 ${base}`;
    default:
      return isActive ? `text-blue-600 ${base}` : `text-slate-500 ${base}`;
  }
}
</script>
