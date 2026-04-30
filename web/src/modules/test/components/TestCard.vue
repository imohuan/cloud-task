<template>
  <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div v-if="title || $slots.header" class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
      <div>
        <h2 class="text-sm font-semibold text-slate-800">{{ title }}</h2>
        <p v-if="subtitle" class="mt-0.5 text-xs text-slate-400">{{ subtitle }}</p>
      </div>
      <slot name="header" />
    </div>
    <div class="p-5">
      <slot />
    </div>
    <div v-if="$slots.footer" class="border-t border-slate-100 bg-slate-50/60 px-5 py-3">
      <slot name="footer" />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title?: string;
  subtitle?: string;
}>();
</script>
