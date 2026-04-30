<template>
  <div class="min-h-screen bg-slate-50">
    <header class="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur-sm">
      <div class="mx-auto flex h-14 max-w-5xl items-center gap-3 px-6">
        <a href="/test" class="flex items-center gap-2 text-slate-400 transition-colors hover:text-slate-600">
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          <span class="text-xs font-medium">测试中心</span>
        </a>
        <span class="text-slate-200">/</span>
        <div class="flex items-center gap-2">
          <span v-if="badge" class="rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider" :class="badgeClass">
            {{ badge }}
          </span>
          <h1 class="text-sm font-semibold text-slate-800">{{ title }}</h1>
        </div>
        <div class="ml-auto">
          <slot name="actions" />
        </div>
      </div>
    </header>

    <div class="mx-auto max-w-5xl px-6 py-8">
      <div v-if="description" class="mb-6">
        <p class="text-sm text-slate-500">{{ description }}</p>
      </div>

      <div class="space-y-6">
        <slot />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    title: string;
    description?: string;
    badge?: string;
    badgeColor?: "blue" | "green" | "amber" | "red" | "purple" | "slate";
  }>(),
  {
    badgeColor: "blue",
  },
);

const badgeClass = computed(() => {
  const map: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    red: "bg-red-50 text-red-600",
    purple: "bg-purple-50 text-purple-600",
    slate: "bg-slate-100 text-slate-600",
  };
  return map[props.badgeColor] ?? map.blue;
});
</script>
