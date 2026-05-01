<template>
  <div class="font-sans text-sm w-full">
    <!-- Header toggle -->
    <button
      class="flex items-center gap-1.5 text-[12px] text-zinc-500 hover:text-zinc-700 transition-colors w-full text-left"
      @click="collapsed = !collapsed"
    >
      <!-- Search icon -->
      <svg class="w-3.5 h-3.5 shrink-0 text-zinc-400" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8">
        <circle cx="6.5" cy="6.5" r="4" />
        <path d="M11 11l3 3" stroke-linecap="round" />
      </svg>

      <span class="truncate">
        Searched web for
        <span class="font-medium text-zinc-700">"{{ query }}"</span>
      </span>

      <!-- Pending spinner -->
      <svg v-if="isStreaming" class="w-3 h-3 shrink-0 ml-0.5 animate-spin text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke-linecap="round" />
      </svg>

      <!-- Chevron -->
      <svg
        class="w-3 h-3 shrink-0 ml-auto text-zinc-400 transition-transform duration-200"
        :class="collapsed ? '' : 'rotate-90'"
        viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.5"
      >
        <polyline points="5,3 11,8 5,13" />
      </svg>
    </button>

    <!-- Results list -->
    <div v-if="!collapsed && results.length" class="mt-1.5 border-l border-zinc-200 pl-3 ml-1.5 flex flex-col gap-0.5">
      <a
        v-for="(item, i) in results"
        :key="i"
        :href="item.url ?? '#'"
        target="_blank"
        class="flex items-start gap-1.5 group/item py-0.5"
      >
        <!-- Favicon or dot -->
        <img
          v-if="item.favicon"
          :src="item.favicon"
          class="w-3.5 h-3.5 mt-0.5 rounded-sm shrink-0 object-contain"
          @error="(e) => (e.target as HTMLImageElement).style.display = 'none'"
        />
        <span v-else class="w-1.5 h-1.5 mt-1.5 rounded-full bg-zinc-300 shrink-0" />

        <span class="text-[12px] text-zinc-600 group-hover/item:text-zinc-900 truncate leading-5 transition-colors">
          {{ item.title }}
        </span>
      </a>
    </div>

    <!-- Empty / loading placeholder -->
    <div v-else-if="!collapsed && isStreaming" class="mt-1.5 border-l border-zinc-200 pl-3 ml-1.5">
      <div v-for="n in 3" :key="n" class="h-3.5 my-1 rounded bg-zinc-100 animate-pulse" :style="{ width: `${60 + n * 10}%` }" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";

interface SearchResult {
  title: string;
  url?: string;
  favicon?: string;
  snippet?: string;
}

const props = defineProps<{
  query: string;
  results?: SearchResult[];
  isStreaming?: boolean;
}>();

const collapsed = ref(false);

watch(
  () => props.isStreaming,
  (streaming) => {
    if (!streaming && props.results?.length) collapsed.value = true;
  },
);

const results = ref<SearchResult[]>(props.results ?? []);
watch(() => props.results, (v) => { results.value = v ?? []; });
</script>
