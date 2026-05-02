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
  "bat": `<svg class="w-3.5 h-3.5" viewBox="0 0 32 32" fill="none"><rect width="32" height="32" rx="4" fill="#E44D26" fill-opacity="0.1"/><path d="M6 8h20v16H6V8z" fill="#D32F2F"/><path d="M9 11h2v2H9v-2zm4 0h6v2h-6v-2zm0 4h6v2h-6v-2zm-4 4h2v2H9v-2zm4 0h6v2h-6v-2z" fill="#fff"/></svg>`,
  "css": `<svg class="w-3.5 h-3.5" viewBox="0 0 32 32"><rect width="32" height="32" rx="4" fill="#1572B6"/><path d="M7 4l2.5 22L16 28l6.5-2L25 4H7zm14.5 7.5h-8l.2 2h7.8l-.5 5.5-5 1.5-5-1.5-.2-2.5h2l.1 1 3.1.8 3.1-.8.2-2.5h-8.5l-.6-7.5h11.5l-.2 2z" fill="#fff"/></svg>`,
  "go": `<svg class="w-3.5 h-3.5" viewBox="0 0 32 32"><rect width="32" height="32" rx="4" fill="#00ADD8"/><path d="M23 15.5c0 3.6-2.5 6.5-7 6.5s-7-2.9-7-6.5S11.5 9 16 9c2.8 0 4.8 1.1 6 2.5l-2.5 2c-.8-1-2-1.5-3.5-1.5-2.5 0-4 1.5-4 3.5s1.5 3.5 4 3.5c2 0 3.5-1 3.5-2.5H16v-2h7v3z" fill="#fff"/></svg>`,
  "html": `<svg class="w-3.5 h-3.5" viewBox="0 0 32 32"><rect width="32" height="32" rx="4" fill="#E44D26"/><path d="M7 4l2.5 22L16 28l6.5-2L25 4H7zm13.5 13.5l-.5 5.5-4 1.2-4-1.2-.2-2.5h2.5l.1 1.2 1.6.4 1.6-.4.2-2.5H12l-.2-2.5h8l-.2-2.5H9.5l-.2-2.5h11l-.3 10z" fill="#fff"/></svg>`,
  "jpg": `<svg class="w-3.5 h-3.5" viewBox="0 0 32 32"><rect width="32" height="32" rx="4" fill="#29B6F6"/><path d="M6 6h20v20H6V6zm2 16l5-5 4 4 6-9 3 3v-10h-18v17z" fill="#fff"/></svg>`,
  "md": `<svg class="w-3.5 h-3.5" viewBox="0 0 32 32"><rect width="32" height="32" rx="4" fill="#424242"/><path d="M7 10v12h4l2-3 2 3h4V10h-3v7l-2-3-2 3V10H7zm14 0v5h2v-5h-2zm0 7v5h2v-5h-2z" fill="#fff"/></svg>`,
  "rs": `<svg class="w-3.5 h-3.5" viewBox="0 0 32 32"><rect width="32" height="32" rx="4" fill="#DEA584"/><path d="M16 6a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 3a7 7 0 1 1 0 14 7 7 0 0 1 0-14zM14 12v2h4v-2h-4zm0 3v5h2v-2h2v2h2v-5h-6z" fill="#000" fill-opacity="0.8"/></svg>`,
  "sh": `<svg class="w-3.5 h-3.5" viewBox="0 0 32 32"><rect width="32" height="32" rx="4" fill="#4CAF50"/><path d="M10 10l6 6-6 6M17 21h5" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  "sql": `<svg class="w-3.5 h-3.5" viewBox="0 0 32 32"><rect width="32" height="32" rx="4" fill="#FFCA28"/><path d="M16 8c-5 0-9 1.5-9 3.5s4 3.5 9 3.5 9-1.5 9-3.5S21 8 16 8zm-9 6v3.5c0 2 4 3.5 9 3.5s9-1.5 9-3.5V14c-1.5 1.5-5 2.5-9 2.5s-7.5-1-9-2.5zm0 6v3.5c0 2 4 3.5 9 3.5s9-1.5 9-3.5V20c-1.5 1.5-5 2.5-9 2.5s-7.5-1-9-2.5z" fill="#000" fill-opacity="0.6"/></svg>`,
  "svg": `<svg class="w-3.5 h-3.5" viewBox="0 0 32 32"><rect width="32" height="32" rx="4" fill="#FFB300"/><path d="M10 10c-1 0-2 1-2 2v8c0 1 1 2 2 2h12c1 0 2-1 2-2v-8c0-1-1-2-2-2H10zm0 2h12v8l-4-4-3 3-3-5-2 2v-4z" fill="#fff"/></svg>`,
  "ts": `<svg class="w-3.5 h-3.5" viewBox="0 0 32 32"><rect width="32" height="32" rx="4" fill="#3178C6"/><path d="M22 20h2v2h-8v-2h3v-8h-3v-2h8v2h-2v8zM10 10h5v2h-2v8h-3v-8H8v-2h2z" fill="#fff"/></svg>`,
  "txt": `<svg class="w-3.5 h-3.5" viewBox="0 0 32 32"><rect width="32" height="32" rx="4" fill="#78909C"/><path d="M9 10h14v2H9v-2zm0 5h14v2H9v-2zm0 5h10v2H9v-2z" fill="#fff" fill-opacity="0.8"/></svg>`,
  "bun.lock": `<svg class="w-3.5 h-3.5" viewBox="0 0 32 32"><rect width="32" height="32" rx="16" fill="#f9f5d7"/><path d="M16 8c-4 0-7 3-7 7 0 4 3 9 7 9s7-5 7-9c0-4-3-7-7-7zm-2 6a1 1 0 1 1 2 0 1 1 0 0 1-2 0zm4 0a1 1 0 1 1 2 0 1 1 0 0 1-2 0z" fill="#444"/></svg>`,
  "js": `<svg class="w-3.5 h-3.5" viewBox="0 0 32 32"><rect width="32" height="32" rx="4" fill="#F7DF1E"/><path d="M24 22h-2.5v-2h1v-4.5h-2v2h-1.5v-4h6v8.5zm-8-3h2v1.5c0 1.5-1 2.5-3 2.5s-3-1-3-2.5h2.5c0 .5.2.8.5.8s.5-.3.5-.8V10h2.5v9z" fill="#000" fill-opacity="0.8"/></svg>`,
  "json": `<svg class="w-3.5 h-3.5" viewBox="0 0 32 32"><rect width="32" height="32" rx="4" fill="#8BC34A"/><path d="M13 10c-2 0-3 1-3 3v2c0 1 1 1 1 1s-1 0-1 1v2c0 2 1 3 3 3h1v-2h-1c-1 0-1-.5-1-1v-2c0-1 1-1 2-1v-2c-1 0-2 0-2-1v-2c0-.5 0-1 1-1h1v-2h-1zm6 0c2 0 3 1 3 3v2c0 1-1 1-1 1s1 0 1 1v2c0 2-1 3-3 3h-1v-2h1c1 0 1-.5 1-1v-2c0-1-1-1-2-1v-2c1 0 2 0 2-1v-2c0-.5 0-1-1-1h-1v-2h1z" fill="#fff"/></svg>`,
}

function getFileIconKey(filePath: string): string {
  if (!filePath) return 'file'
  const filename = filePath.split(/[/\\]/).pop() || ''
  if (filename === 'bun.lockb' || filename === 'bun.lock') return 'bun.lock'
  if (filename.startsWith('.env')) return 'txt'
  const dotIndex = filename.lastIndexOf('.')
  if (dotIndex < 0) return 'file'
  const ext = filename.slice(dotIndex + 1).toLowerCase()
  const extMap: Record<string, string> = {
    vue: 'js',
    md: 'md', mdx: 'md',
    js: 'js', mjs: 'js', cjs: 'js',
    jsx: 'js',
    ts: 'ts', mts: 'ts', cts: 'ts',
    tsx: 'ts',
    css: 'css', scss: 'css', sass: 'css', less: 'css',
    html: 'html', htm: 'html',
    json: 'json', jsonc: 'json',
    py: 'bat', pyw: 'bat',
    go: 'go',
    rs: 'rs',
    sh: 'sh', bash: 'sh', zsh: 'sh', fish: 'sh',
    bat: 'bat', cmd: 'bat',
    yaml: 'txt', yml: 'txt',
    toml: 'txt',
    sql: 'sql',
    png: 'jpg', jpg: 'jpg', jpeg: 'jpg', gif: 'jpg', webp: 'jpg', ico: 'jpg', bmp: 'jpg',
    svg: 'svg',
    txt: 'txt',
    xml: 'txt',
  }
  return extMap[ext] || 'file'
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
  } else if (["read_file"].includes(name)) {
    return { icon: getFileIconKey(args?.path || ""), desc: "Read File", file: args?.path || "", content: result?.content || "" }
  }

  return { icon: "error", desc: "未知错误", file: "", content: "" }
})

</script>
