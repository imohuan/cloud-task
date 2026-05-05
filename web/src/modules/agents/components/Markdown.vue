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
  font-size: 0.875rem;
  padding: 0.5rem 0;
}
:deep(.comark-preview h1) { font-size: 1.125rem !important; margin-bottom: 0.5rem; margin-top: 0.25rem; }
:deep(.comark-preview h2) { font-size: 1rem !important; margin-top: 0.75rem; margin-bottom: 0.4rem; }
:deep(.comark-preview h3) { font-size: 0.9375rem !important; margin-top: 0.6rem; margin-bottom: 0.3rem; }
:deep(.comark-preview p)  { font-size: 0.875rem; margin-bottom: 0.5rem; line-height: 1.7; }
:deep(.comark-preview li) { font-size: 0.875rem; margin-bottom: 0.2rem; }
:deep(.comark-preview code) { font-size: 0.8125rem; }
:deep(.comark-preview ul),
:deep(.comark-preview ol) { margin-bottom: 0.5rem; }
</style>
