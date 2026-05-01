<template>
  <div class="flex items-center gap-1.5 text-[12px] text-zinc-400 font-sans">
    <!-- File icon -->
    <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6">
      <path d="M4 2h6l3 3v9H4V2z" stroke-linejoin="round" />
      <path d="M9 2v4h3" stroke-linejoin="round" />
    </svg>
    <span>Read</span>
    <span class="text-zinc-500 font-medium">{{ filename }}</span>
  </div>
</template>

<script setup lang="ts">
defineProps<{ filename: string }>();
</script>
