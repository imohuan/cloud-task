<template>
  <div class="relative flex h-full flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
    <!-- 工具栏 -->
    <div class="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-4 py-2">
      <div class="flex gap-4">
        <div class="flex items-center gap-2">
          <div class="h-2 w-2 animate-pulse rounded-full" :class="isConnected ? 'bg-emerald-500' : 'bg-red-500'"></div>
          <span class="text-xs font-medium text-slate-500">{{ isConnected ? "连接正常" : "连接断开" }}</span>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <div class="h-4 w-px bg-slate-200"></div>

        <!-- 自动滚动开关 -->
        <label class="flex cursor-pointer items-center gap-2">
          <span class="text-xs font-medium text-slate-600">自动滚动</span>
          <div class="relative inline-flex items-center">
            <input
              :checked="autoScroll"
              @change="$emit('update:autoScroll', ($event.target as HTMLInputElement).checked)"
              class="peer sr-only"
              type="checkbox"
            />
            <div
              class="h-5 w-9 rounded-full bg-slate-200 peer-checked:bg-blue-600 peer-focus:outline-none after:absolute after:top-[2px] after:left-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all peer-checked:after:translate-x-full peer-checked:after:border-white"
            ></div>
          </div>
        </label>

        <!-- 显示行号 -->
        <button
          @click="showLineNumbers = !showLineNumbers"
          class="flex items-center gap-1.5 rounded-lg px-2 py-1 transition-colors"
          :class="showLineNumbers ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:bg-slate-100'"
          title="显示行号"
        >
          <FormatListNumberedRound class="h-4 w-4" />
        </button>

        <!-- 复制日志 -->
        <button
          @click="copyLogs"
          :disabled="!hasFile"
          class="flex items-center rounded-lg px-2 py-1 transition-colors disabled:opacity-50"
          :class="copied ? 'text-emerald-500' : 'text-slate-400 hover:text-blue-600'"
          title="复制日志"
        >
          <component :is="copied ? DoneRound : ContentCopyRound" class="h-4 w-4" />
        </button>

        <!-- 自动换行开关 -->
        <button
          @click="$emit('update:wrapLines', !wrapLines)"
          class="flex items-center gap-1.5 rounded-lg px-2 py-1 transition-colors"
          :class="wrapLines ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:bg-slate-100'"
          title="自动换行"
        >
          <WrapTextRound class="h-4 w-4" />
        </button>

        <div class="h-4 w-px bg-slate-200"></div>
        <button
          @click="$emit('download')"
          :disabled="!hasFile"
          class="text-slate-400 transition-colors hover:text-blue-600 disabled:opacity-50"
        >
          <DownloadRound class="h-5 w-5" />
        </button>
      </div>
    </div>

    <!-- 日志内容区域 -->
    <div
      class="log-scrollbar relative flex-1 overflow-y-auto font-mono text-[13px] leading-5"
      ref="containerRef"
      @scroll="$emit('scroll')"
      @contextmenu.prevent="$emit('contextmenu', $event)"
    >
      <!-- 空状态 -->
      <div v-if="!hasFile" class="flex h-full items-center justify-center text-slate-300">
        <div class="text-center">
          <DescriptionRound class="mx-auto mb-4 h-12 w-12" />
          <p class="text-sm text-slate-400">从顶部下拉选择日志文件</p>
        </div>
      </div>

      <!-- 加载中 -->
      <div v-else-if="isLoadingContent" class="flex h-full items-center justify-center">
        <div class="flex items-center gap-2 text-slate-400">
          <SyncRound class="h-5 w-5 animate-spin" />
          <span>加载中...</span>
        </div>
      </div>

      <!-- 日志内容 -->
      <div v-else class="p-2 select-text" :class="wrapLines ? '' : 'min-w-max'">
        <!-- 加载历史 -->
        <div v-if="hasMoreLines" class="py-2 text-center">
          <button
            @click="$emit('load-more')"
            :disabled="isLoadingMore"
            class="mx-auto flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50"
          >
            <KeyboardArrowUpRound class="h-4 w-4" />
            {{ isLoadingMore ? "加载中..." : "加载历史" }}
          </button>
        </div>

        <!-- 日志行 — 用行号作稳定 key，SSE 追加行不破坏已有 DOM -->
        <div
          v-for="(line, index) in logLines"
          :key="index"
          class="flex cursor-text items-start gap-4 px-4 py-1 hover:bg-slate-50"
        >
          <span v-show="showLineNumbers" class="w-16 shrink-0 text-right whitespace-nowrap text-slate-400 select-none">{{ getLineNumber(index) }}</span>
          <LogLineRenderer :line="line" :wrap-lines="wrapLines" @show-detail="onShowBase64Detail" />
        </div>

        <!-- 加载最新 -->
        <div v-if="hasNewLines" class="py-2 text-center">
          <button
            @click="$emit('load-new')"
            :disabled="isLoadingNew"
            class="mx-auto flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50"
          >
            <KeyboardArrowDownRound class="h-4 w-4" />
            {{ isLoadingNew ? "加载中..." : `加载最新 (${newLinesCount} 行)` }}
          </button>
        </div>
      </div>
    </div>

    <!-- 回到底部浮动按钮 -->
    <div v-if="hasFile && !isUserNearBottom" class="absolute bottom-14 left-1/2 z-10 -translate-x-1/2 transform">
      <button
        @click="$emit('scroll-to-bottom')"
        class="flex items-center gap-2 rounded-full bg-slate-800 px-4 py-2 text-xs text-white shadow-lg transition-all hover:bg-slate-700"
      >
        <ArrowDownwardRound class="h-3.5 w-3.5" />
        <span>回到底部</span>
        <span v-if="hasNewLines" class="ml-1 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px]">{{
          newLinesCount
        }}</span>
      </button>
    </div>

    <!-- Base64 详情弹窗 -->
    <Base64Modal
      :visible="base64ModalVisible"
      :content="base64ModalContent"
      :mime-type="base64ModalMime"
      @close="base64ModalVisible = false"
    />

    <!-- 状态栏 -->
    <div
      v-if="hasFile"
      class="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-1.5 text-[11px] text-slate-500"
    >
      <div class="flex items-center gap-2">
        <span>显示 {{ logLines.length }} 行</span>
        <span v-if="hasNewLines" class="rounded-full bg-blue-100 px-2 py-0.5 text-blue-600"
          >{{ newLinesCount }} 新日志</span
        >
      </div>
      <span v-if="activeLevelFilters.length < 4" class="text-blue-600">筛选: {{ activeLevelFilters.join(", ") }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useAppStore } from "@/stores";
import {
  WrapTextRound,
  DownloadRound,
  DescriptionRound,
  SyncRound,
  KeyboardArrowUpRound,
  KeyboardArrowDownRound,
  ArrowDownwardRound,
  FormatListNumberedRound,
  ContentCopyRound,
  DoneRound,
} from "@vicons/material";
import type { LogLevel } from "../types";
import LogLineRenderer from "./LogLineRenderer.vue";
import Base64Modal from "./Base64Modal.vue";
import type { Base64Segment } from "./LogLineRenderer.vue";

const props = defineProps<{
  logLines: string[];
  hasFile: boolean;
  isLoadingContent: boolean;
  isLoadingMore: boolean;
  isLoadingNew: boolean;
  hasMoreLines: boolean;
  hasNewLines: boolean;
  newLinesCount: number;
  isConnected: boolean;
  isUserNearBottom: boolean;
  autoScroll: boolean;
  wrapLines: boolean;
  totalLines: number;
  activeLevelFilters: LogLevel[];
}>();

defineEmits<{
  scroll: [];
  "update:autoScroll": [value: boolean];
  "update:wrapLines": [value: boolean];
  download: [];
  "load-more": [];
  "load-new": [];
  "scroll-to-bottom": [];
  contextmenu: [event: MouseEvent];
}>();

const containerRef = ref<HTMLElement | null>(null);
const showLineNumbers = ref(!useAppStore().isMobile);
const copied = ref(false);

const base64ModalVisible = ref(false);
const base64ModalContent = ref("");
const base64ModalMime = ref<string | undefined>(undefined);

function onShowBase64Detail(seg: Base64Segment) {
  base64ModalContent.value = seg.content;
  base64ModalMime.value = seg.mimeType;
  base64ModalVisible.value = true;
}

defineExpose({ containerRef });

async function copyLogs() {
  try {
    await navigator.clipboard.writeText(props.logLines.join("\n"));
    copied.value = true;
    setTimeout(() => { copied.value = false; }, 2000);
  } catch (e) {
    console.error("复制失败", e);
  }
}

function getLineNumber(index: number) {
  const total = props.totalLines || 0;
  const currentCount = props.logLines.length;
  return Math.max(0, total - currentCount) + index + 1;
}

</script>
