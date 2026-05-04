<script setup lang="ts">
/**
 * 自定义代码块渲染组件
 * 通过 :components="{ pre: CodeBlock }" 覆盖 comark 内置 pre 渲染
 * comark 会把原始节点属性（language / filename 等）作为 props 传入，
 * 高亮后的子节点（code > span...）通过默认 slot 传入。
 */
import { ref, computed, onMounted, onUnmounted } from "vue";

const props = defineProps<{
  language?: string;
  filename?: string;
}>();

const preRef = ref<HTMLPreElement>();
const isFullscreen = ref(false);
const copied = ref(false);

const isHtml = computed(() => props.language?.toLowerCase() === "html");
const label = computed(() => props.filename || props.language || "code");

function getCode(): string {
  return preRef.value?.textContent ?? "";
}

async function copyCode() {
  try {
    await navigator.clipboard.writeText(getCode());
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  } catch {
    /* clipboard unavailable */
  }
}

function openHtmlPreview() {
  const blob = new Blob([getCode()], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank");
}

function openFullscreen() {
  isFullscreen.value = true;
}

function closeFullscreen() {
  isFullscreen.value = false;
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Escape" && isFullscreen.value) closeFullscreen();
}

onMounted(() => document.addEventListener("keydown", onKeydown));
onUnmounted(() => document.removeEventListener("keydown", onKeydown));
</script>

<template>
  <!-- Inline code block -->
  <div class="code-block-wrapper mb-3 overflow-hidden rounded-lg border border-slate-200">
    <!-- Header -->
    <div class="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-1.5">
      <span class="font-mono text-xs text-slate-400">{{ label }}</span>
      <div class="flex items-center gap-0.5">
        <!-- HTML Preview -->
        <button
          v-if="isHtml"
          class="flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
          title="在新页面预览 HTML"
          @click="openHtmlPreview"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
          Preview
        </button>
        <!-- Fullscreen -->
        <button
          class="flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
          title="全屏显示"
          @click="openFullscreen"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 3 21 3 21 9" />
            <polyline points="9 21 3 21 3 15" />
            <line x1="21" y1="3" x2="14" y2="10" />
            <line x1="3" y1="21" x2="10" y2="14" />
          </svg>
        </button>
        <!-- Copy -->
        <button
          class="flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors"
          :class="copied ? 'text-green-500' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'"
          title="复制代码"
          @click="copyCode"
        >
          <svg v-if="copied" xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <svg v-else xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          {{ copied ? "Copied!" : "Copy" }}
        </button>
      </div>
    </div>
    <!-- Code -->
    <div class="relative overflow-x-auto p-4">
      <pre ref="preRef" class="m-0 select-text text-sm leading-relaxed"><slot /></pre>
    </div>
  </div>

  <!-- Fullscreen modal -->
  <Teleport to="body">
    <div v-if="isFullscreen" class="code-block-fs fixed inset-0 z-999 flex flex-col bg-white">
      <!-- Fullscreen header -->
      <div class="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2">
        <span class="font-mono text-sm text-slate-400">{{ label }}</span>
        <div class="flex items-center gap-0.5">
          <!-- HTML Preview -->
          <button
            v-if="isHtml"
            class="flex items-center gap-1 rounded px-2.5 py-1.5 text-xs text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
            title="在新页面预览 HTML"
            @click="openHtmlPreview"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            Preview
          </button>
          <!-- Copy -->
          <button
            class="flex items-center gap-1 rounded px-2.5 py-1.5 text-xs transition-colors"
            :class="copied ? 'text-green-500' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'"
            title="复制代码"
            @click="copyCode"
          >
            <svg v-if="copied" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            {{ copied ? "Copied!" : "Copy" }}
          </button>
          <!-- Close -->
          <button
            class="flex items-center gap-1 rounded px-2.5 py-1.5 text-xs text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
            title="退出全屏 (Esc)"
            @click="closeFullscreen"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="4 14 10 14 10 20" />
              <polyline points="20 10 14 10 14 4" />
              <line x1="10" y1="14" x2="21" y2="3" />
              <line x1="3" y1="21" x2="14" y2="10" />
            </svg>
            Esc
          </button>
        </div>
      </div>
      <!-- Fullscreen code (re-render slot) -->
      <div class="flex-1 overflow-auto p-6">
        <pre class="m-0 select-text text-sm leading-relaxed"><slot /></pre>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.code-block-fs :deep(.shiki) {
  background-color: transparent !important;
}
</style>
