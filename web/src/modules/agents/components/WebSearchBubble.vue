<template>
  <div class="font-sans text-sm w-full">
    <!-- Header toggle -->
    <button
      class="flex items-center gap-1.5 text-[12px] text-zinc-500 hover:text-zinc-700 transition-colors w-full text-left"
      @click="collapsed = !collapsed">
      <!-- Search icon -->
      <svg class="w-3.5 h-3.5 shrink-0 text-zinc-400" viewBox="0 0 16 16" fill="none" stroke="currentColor"
        stroke-width="1.8">
        <circle cx="6.5" cy="6.5" r="4" />
        <path d="M11 11l3 3" stroke-linecap="round" />
      </svg>

      <span class="truncate">
        搜索网页
        <span class="font-medium text-zinc-700">"{{ query }}"</span>
        <span v-if="responseTime" class="ml-1 text-zinc-400 font-normal">({{ responseTime }}s)</span>
      </span>

      <!-- Result count badge -->
      <span v-if="results.length" class="ml-1 text-zinc-400 text-[10px] shrink-0">{{ results.length }} 条</span>

      <!-- Chevron -->
      <svg class="w-3 h-3 shrink-0 ml-auto text-zinc-400 transition-transform duration-200"
        :class="collapsed ? '' : 'rotate-90'" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.5">
        <polyline points="5,3 11,8 5,13" />
      </svg>
    </button>

    <!-- Results list -->
    <div v-if="!collapsed && results.length" class="mt-1.5 border-l border-zinc-200 pl-3 ml-1.5 flex flex-col gap-1">
      <a v-for="(item, i) in results" :key="i" :href="item.url ?? '#'" target="_blank"
        class="flex flex-col gap-0.5 group/item py-0.5">
        <div class="flex items-center gap-1.5">
          <img :src="`https://www.google.com/s2/favicons?domain=${getDomain(item.url)}&sz=16`"
            class="w-3.5 h-3.5 rounded-sm shrink-0 object-contain"
            @error="(e) => (e.target as HTMLImageElement).style.display = 'none'" />
          <span
            class="text-[12px] text-zinc-600 group-hover/item:text-zinc-900 truncate leading-5 transition-colors font-medium">
            {{ item.title }}
          </span>
          <span v-if="item.score != null" class="ml-auto text-[10px] text-zinc-300 shrink-0">
            {{ (item.score * 100).toFixed(0) }}%
          </span>
        </div>

        <!-- 展示关闭 -->
        <!-- <p v-if="item.content" class="text-[11px] text-zinc-400 leading-relaxed pl-5 m-0 max-h-0 overflow-y-auto group-hover/item:max-h-[300px] transition-[max-height] duration-300 ease-in-out">
          {{ item.content }}
        </p> -->
      </a>
    </div>

    <!-- Empty / loading placeholder -->
    <div v-else-if="!collapsed && toolCall.state === 'pending'" class="mt-1.5 border-l border-zinc-200 pl-3 ml-1.5">
      <div v-for="n in 3" :key="n" class="h-3.5 my-1 rounded bg-zinc-100 animate-pulse"
        :style="{ width: `${60 + n * 10}%` }" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from "vue";
import type { ToolCallWithResult } from "@langchain/vue";

interface SearchResult {
  title: string;
  url?: string;
  content?: string;
  rawContent?: string | null;
  score?: number;
}

interface SearchResponse {
  query?: string;
  responseTime?: number;
  images?: any[];
  results?: SearchResult[];
}

const props = defineProps<{
  toolCall: ToolCallWithResult;
}>();

const collapsed = ref(false);

const query = computed<string>(() => {
  const args = props.toolCall.call.args;
  return (args as any)?.query ?? "";
});

const parsed = computed<SearchResponse>(() => {
  const content = props.toolCall.result?.content;
  if (!content) return {};
  try {
    const str = typeof content === "string" ? content : JSON.stringify(content);
    return JSON.parse(str) as SearchResponse;
  } catch {
    return {};
  }
});

const responseTime = computed(() => parsed.value.responseTime);
const results = computed<SearchResult[]>(() => parsed.value.results ?? []);

watch(
  () => props.toolCall.state,
  (state) => {
    if (state === "completed" && results.value.length) collapsed.value = true;
  },
);

function getDomain(url?: string): string {
  if (!url) return "";
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}
</script>
