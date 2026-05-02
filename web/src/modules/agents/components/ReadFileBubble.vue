<template>
  <div class="text-[12px] font-sans">
    <div class="flex items-center gap-1.5 text-zinc-500 cursor-pointer select-none" @click="expanded = !expanded">
      <!-- Dynamic icon -->
      <span class="flex items-center shrink-0" v-html="icons[data.icon]"></span>
      <span class="font-mono">{{ data.desc }}</span>
      <span class="text-zinc-400 font-mono">{{ data.file }}</span>
    </div>
    <div class="overflow-hidden transition-all duration-300 ease-in-out"
      :style="expanded ? 'max-height: 210px; opacity: 1' : 'max-height: 0; opacity: 0'">
      <pre
        class="mt-1.5 p-2 rounded bg-zinc-50 border border-zinc-200 text-zinc-700 text-[11px] font-mono whitespace-pre-wrap break-all leading-relaxed overflow-y-auto max-h-[200px]">{{ data.content }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ToolCallWithResult } from "@langchain/vue";
import { computed, ref } from "vue";

const props = defineProps<{
  toolCall: ToolCallWithResult;
}>();

const expanded = ref(false)

const icons: Record<string, string> = {
  file: `<svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 2h6l3 3v9H4V2z" stroke-linejoin="round"/><path d="M9 2v4h3" stroke-linejoin="round"/></svg>`,
  link: `<svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6.5 9.5a3.536 3.536 0 0 0 5 0l2-2a3.536 3.536 0 0 0-5-5l-1 1" stroke-linecap="round" stroke-linejoin="round"/><path d="M9.5 6.5a3.536 3.536 0 0 0-5 0l-2 2a3.536 3.536 0 0 0 5 5l1-1" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  skill: `<svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 2a1 1 0 0 0-1 1v.5H3.5A1.5 1.5 0 0 0 2 5v7a1.5 1.5 0 0 0 1.5 1.5h9A1.5 1.5 0 0 0 14 12V5a1.5 1.5 0 0 0-1.5-1.5H11V3a1 1 0 0 0-1-1H6z" stroke-linejoin="round"/><circle cx="8" cy="8.5" r="1.5" stroke-linejoin="round"/></svg>`,
  youtube: `<svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="1" y="3" width="14" height="10" rx="2" stroke-linejoin="round"/><path d="M6.5 5.5l4 2.5-4 2.5V5.5z" fill="currentColor" stroke="none"/></svg>`,
  error: `<svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M8 2L2 13h12L8 2z" stroke-linejoin="round"/><path d="M8 6.5v3" stroke-linecap="round"/><circle cx="8" cy="11" r="0.6" fill="currentColor" stroke="none"/></svg>`,
}

const data = computed(() => {
  const call = props.toolCall?.call
  if (!call) return { icon: "error", desc: "未知错误", file: "", content: "" }

  const { name, args } = call
  const result = props.toolCall?.result

  if (name === "load_skill") {
    return { icon: "skill", desc: "Load Skill", file: args?.skillName || "", content: result?.content || "" }
  } else if (name === "fetch_youtube_transcript") {
    return { icon: "youtube", desc: "Fetch Transcript", file: args?.url || "", content: result?.content || "" }
  } else if (["fetch_html", "fetch_markdown", "fetch_txt", "fetch_json", "fetch_readable"].includes(name)) {
    return { icon: "link", desc: "Fetch", file: args?.url || "", content: result?.content || "" }
  }

  return { icon: "error", desc: "未知错误", file: "", content: "" }
})

</script>
