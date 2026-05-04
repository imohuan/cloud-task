<template>
  <span :class="[wrapLines ? 'break-all whitespace-pre-wrap' : 'whitespace-nowrap', lineClass]" class="select-text">
    <template v-for="(seg, i) in segments" :key="i">
      <!-- URL -->
      <a
        v-if="seg.type === 'url'"
        :href="seg.content"
        target="_blank"
        rel="noopener noreferrer"
        class="underline decoration-current opacity-80 hover:opacity-100"
      >{{ seg.content }}</a>

      <!-- Base64 / Data URI (truncated badge) -->
      <span
        v-else-if="seg.type === 'base64' || seg.type === 'data-uri'"
        class="inline-flex cursor-pointer items-center gap-1 rounded bg-slate-100 px-1 font-mono text-[11px] text-slate-500 hover:bg-slate-200 active:bg-slate-300"
        title="点击查看完整内容"
        @click="$emit('show-detail', seg)"
      >
        <span>{{ seg.preview }}</span>
        <span class="select-none text-[9px] text-slate-400">·base64·{{ seg.content.length }}c</span>
      </span>

      <!-- Plain text -->
      <span v-else>{{ seg.content }}</span>
    </template>
  </span>
</template>

<script setup lang="ts">
import { computed } from "vue";

export interface Base64Segment {
  type: "base64" | "data-uri";
  content: string;
  preview: string;
  mimeType?: string;
}

interface UrlSegment {
  type: "url";
  content: string;
}

interface TextSegment {
  type: "text";
  content: string;
}

type Segment = TextSegment | UrlSegment | Base64Segment;

const props = defineProps<{
  line: string;
  wrapLines?: boolean;
}>();

defineEmits<{
  "show-detail": [segment: Base64Segment];
}>();

function makePreview(content: string): string {
  if (content.length <= 100) return content;
  return content.slice(0, 60) + "…" + content.slice(-20);
}

const segments = computed<Segment[]>(() => {
  const line = props.line;
  if (!line) return [];

  const REGEX =
    /(https?:\/\/[^\s<>"{}|\\^`[\]]+)|(data:[a-zA-Z]+\/[a-zA-Z0-9+]+;base64,[A-Za-z0-9+/\r\n]+=*)|([A-Za-z0-9+/]{100,}={0,2})/g;

  const result: Segment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = REGEX.exec(line)) !== null) {
    if (match.index > lastIndex) {
      result.push({ type: "text", content: line.slice(lastIndex, match.index) });
    }

    if (match[1]) {
      result.push({ type: "url", content: match[1] });
    } else if (match[2]) {
      const mimeMatch = match[2].match(/^data:([^;]+);base64,(.+)$/s);
      const mimeType = mimeMatch?.[1];
      const b64Content = mimeMatch?.[2] ?? match[2];
      result.push({ type: "data-uri", content: b64Content, preview: makePreview(b64Content), mimeType });
    } else if (match[3]) {
      result.push({ type: "base64", content: match[3], preview: makePreview(match[3]) });
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < line.length) {
    result.push({ type: "text", content: line.slice(lastIndex) });
  }

  return result;
});

const lineClass = computed(() => {
  const line = props.line;
  if (line.includes("[ERROR]") || line.includes(" ERROR ")) return "font-medium text-red-600";
  if (line.includes("[WARN]") || line.includes(" WARN ")) return "text-amber-600";
  if (line.includes("[DEBUG]") || line.includes(" DEBUG ")) return "text-slate-500";
  return "text-emerald-600";
});
</script>
