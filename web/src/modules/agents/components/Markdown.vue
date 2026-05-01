<template>
  <div class="min-h-0 overflow-hidden">
    <StreamOutPreview :content="content" :auto-scroll="autoScroll" />
  </div>
</template>

<script setup lang="ts">
import StreamOutPreview from "@/components/streamout/StreamOutPreview.vue";

defineProps<{
  content: string;
  autoScroll?: boolean;
}>();
</script>

<style scoped>
:deep(.comark-preview) {
  font-size: 0.75rem;
  padding: 0.75rem 1rem;
}
:deep(.comark-preview h1) { font-size: 0.9375rem; margin-bottom: 0.5rem; }
:deep(.comark-preview h2) { font-size: 0.875rem; margin-top: 0.75rem; }
:deep(.comark-preview h3) { font-size: 0.8125rem; }
:deep(.comark-preview p)  { font-size: 0.75rem; margin-bottom: 0.4rem; line-height: 1.6; }
:deep(.comark-preview li) { font-size: 0.75rem; }
:deep(.comark-preview code) { font-size: 0.75rem; }
</style>
