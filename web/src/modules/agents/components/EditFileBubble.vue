<template>
  <div class="font-sans w-full rounded-md overflow-hidden border border-zinc-200 bg-white text-[12px]">
    <!-- Header -->
    <div
      class="flex items-center gap-2 px-3 py-2 bg-zinc-50 border-b border-zinc-200 cursor-pointer select-none"
      @click="collapsed = !collapsed"
    >
      <!-- Spinner (loading) or file icon (done) -->
      <svg v-if="isStreaming" class="w-3.5 h-3.5 shrink-0 text-zinc-400 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke-linecap="round" />
      </svg>
      <svg v-else class="w-3.5 h-3.5 shrink-0 text-emerald-500" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6">
        <path d="M4 2h6l3 3v9H4V2z" stroke-linejoin="round" />
        <path d="M9 2v4h3" stroke-linejoin="round" />
      </svg>

      <span class="text-zinc-700 truncate">{{ filename }}</span>

      <!-- Badges -->
      <div class="ml-auto flex items-center gap-2 shrink-0">
        <span v-if="isNew" class="rounded px-1.5 py-0.5 bg-emerald-100 text-emerald-600 text-[10px] font-medium">new</span>
        <span v-if="isStreaming && tokens != null" class="flex items-center gap-1 text-zinc-400 text-[11px]">
          <svg class="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 3v5l3 2" stroke-linecap="round"/><circle cx="8" cy="8" r="6"/></svg>
          {{ tokens }} tokens
        </span>
        <span v-if="!isStreaming && stats" class="text-[11px] font-mono">
          <span v-if="stats.added" class="text-emerald-400">+{{ stats.added }}</span>
          <span v-if="stats.removed" class="text-red-400 ml-1">-{{ stats.removed }}</span>
        </span>

        <!-- Chevron -->
        <svg
          v-if="!isStreaming && diff.length"
          class="w-3 h-3 text-zinc-400 transition-transform duration-200"
          :class="collapsed ? '' : 'rotate-180'"
          viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.5"
        >
          <polyline points="4,6 8,10 12,6" />
        </svg>
      </div>
    </div>

    <!-- Diff body -->
    <div v-if="!isStreaming && !collapsed && diff.length" class="overflow-x-auto">
      <div class="py-1">
        <div
          v-for="(line, i) in diff"
          :key="i"
          class="px-4 py-px font-mono text-[11px] leading-5 whitespace-pre"
          :class="{
            'bg-emerald-50 text-emerald-700': line.type === 'add',
            'bg-red-50 text-red-600': line.type === 'remove',
            'text-zinc-500': line.type === 'context',
            'text-zinc-400 bg-zinc-50 py-1 text-[10px]': line.type === 'hunk',
          }"
        >{{ linePrefix(line.type) }}{{ line.content }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";

export interface DiffLine {
  type: "add" | "remove" | "context" | "hunk";
  content: string;
}

const props = defineProps<{
  filename: string;
  isStreaming?: boolean;
  isNew?: boolean;
  tokens?: number;
  diff?: DiffLine[];
  stats?: { added?: number; removed?: number };
}>();

const collapsed = ref(true);
const diff = ref<DiffLine[]>(props.diff ?? []);

watch(() => props.diff, (v) => { diff.value = v ?? []; });
watch(() => props.isStreaming, (streaming) => {
  if (!streaming && diff.value.length) collapsed.value = false;
});

function linePrefix(type: DiffLine["type"]): string {
  if (type === "add") return "+ ";
  if (type === "remove") return "- ";
  if (type === "context") return "  ";
  return "";
}
</script>
