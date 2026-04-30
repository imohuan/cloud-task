<template>
  <TestLayout
    title="Comark 流式渲染"
    badge="UI"
    badge-color="green"
    full-width
  >
    <template #actions>
      <div class="flex items-center gap-2">
        <button
          class="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
          :disabled="currentIndex <= 0"
          @click="stepBackward"
        >
          <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          <span>后退</span>
        </button>

        <button
          class="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition"
          :class="
            isPlaying
              ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          "
          @click="togglePlay"
        >
          <svg
            v-if="!isPlaying"
            class="h-3.5 w-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 3l14 9-14 9V3z" />
          </svg>
          <svg
            v-else
            class="h-3.5 w-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M10 9v6m4-6v6" />
          </svg>
          <span>{{ isPlaying ? "暂停" : "播放" }}</span>
        </button>

        <button
          class="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
          :disabled="currentIndex >= fullText.length"
          @click="stepForward"
        >
          <span>前进</span>
          <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>

        <div class="flex items-center gap-1.5">
          <span class="text-xs text-slate-500">倍速</span>
          <input
            v-model.number="speed"
            type="range"
            min="0.5"
            max="10"
            step="0.1"
            class="h-1.5 w-24 cursor-pointer appearance-none rounded-full bg-slate-200 accent-slate-600"
          />
          <span class="w-8 text-right text-xs font-medium text-slate-700">{{ speed.toFixed(1) }}x</span>
        </div>

        <button
          class="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition"
          :class="
            autoScroll
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          "
          @click="autoScroll = !autoScroll"
        >
          <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 13l-7 7-7-7m14-8l-7 7-7-7" />
          </svg>
          <span>{{ autoScroll ? "自动滚动: 开" : "自动滚动: 关" }}</span>
        </button>

        <div class="mx-1 h-4 w-px bg-slate-200" />

        <button
          class="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
          @click="showEditor = !showEditor"
        >
          <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h7" />
          </svg>
          <span>{{ showEditor ? "隐藏编辑" : "显示编辑" }}</span>
        </button>

        <button
          class="flex items-center gap-1 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
          @click="clear"
        >
          <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
          <span>清空</span>
        </button>
      </div>
    </template>

    <div class="h-[calc(100vh-120px)] min-h-[400px]">
      <StreamOut
        :text="fullText"
        :preview="previewText"
        :show-editor="showEditor"
        :auto-scroll="autoScroll"
        @update:text="onTextChange"
      />
    </div>
  </TestLayout>
</template>

<script setup lang="ts">
import { ref, computed, onBeforeUnmount, watch } from "vue";
import TestLayout from "@/modules/test/components/TestLayout.vue";
import StreamOut from "@/components/streamout/StreamOut.vue";

const DEMO_TEXT = `# Built-in typography styles

> Streamout comes with built-in Tailwind classes for common Markdown components — headings, lists, code blocks, and more.

# AI Models Overview

Modern AI models have revolutionized how we interact with technology. From **language models** to computer vision... these systems demonstrate remarkable capabilities.

## Key Features

### Benefits

- Natural language understanding
- Multi-modal processing
- Real-time inference

### Requirements

1. GPU acceleration
2. Model weights
3. API access

## Architecture

![Model Architecture](https://placehold.co/600x400)

## Insights

> *"The development of full artificial intelligence could spell the end of the human race."* — Stephen Hawking

Learn more about [AI safety](https://example.com) and transformer architectures.

# GitHub Flavored Markdown

Streamout supports GitHub Flavored Markdown (GFM) out of the box, so you get things like task lists, tables, and more.

GFM extends standard Markdown with powerful features. Here's a comprehensive demo:

## Tables

| Feature | Support |
|---------|---------|
| Tables | Yes |
| Task lists | Yes |
| Strikethrough | Yes |

## Code Blocks

\`\`\`typescript
function greet(name: string): string {
  return \`Hello, ${name}!\`;
}

console.log(greet("World"));
\`\`\`
`;

const fullText = ref(DEMO_TEXT);
const currentIndex = ref(DEMO_TEXT.length);
const isPlaying = ref(false);
const showEditor = ref(true);
const speed = ref(1);
const autoScroll = ref(true);
let timer: ReturnType<typeof setInterval> | null = null;

const previewText = computed(() => fullText.value.slice(0, currentIndex.value));

watch(speed, () => {
  if (isPlaying.value) {
    stop();
    play();
  }
});

function togglePlay() {
  if (isPlaying.value) {
    stop();
  } else {
    if (currentIndex.value >= fullText.value.length) {
      currentIndex.value = 0;
    }
    play();
  }
}

function play() {
  if (timer) clearInterval(timer);
  isPlaying.value = true;

  timer = setInterval(() => {
    if (currentIndex.value < fullText.value.length) {
      currentIndex.value++;
    } else {
      stop();
    }
  }, 30 / speed.value);
}

function stop() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  isPlaying.value = false;
}

function stepBackward() {
  stop();
  if (currentIndex.value > 0) {
    currentIndex.value--;
  }
}

function stepForward() {
  stop();
  if (currentIndex.value < fullText.value.length) {
    currentIndex.value++;
  }
}

function clear() {
  stop();
  currentIndex.value = 0;
}

function onTextChange(val: string) {
  fullText.value = val;
  if (currentIndex.value > val.length) {
    currentIndex.value = val.length;
  }
}

onBeforeUnmount(() => {
  stop();
});
</script>
