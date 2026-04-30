<template>
  <TestLayout title="SSE 实时日志" description="测试 SSE 连接与实时日志流推送" badge="网络" badge-color="purple">
    <TestCard title="过滤配置" subtitle="输入关键词过滤日志，留空则监听全部">
      <div class="flex items-center gap-3">
        <input
          v-model="searchInput"
          class="input-compact flex-1"
          placeholder="过滤关键词（如 ERROR、task、api 等）"
          @keydown.enter="handleConnect"
        />
        <button
          v-if="!activeSearch"
          class="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-slate-700"
          @click="handleConnect"
        >
          连接
        </button>
        <button
          v-else
          class="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs font-medium text-red-600 transition-colors hover:bg-red-100"
          @click="handleDisconnect"
        >
          断开
        </button>
      </div>
    </TestCard>

    <TestCard title="日志流" subtitle="xterm 终端渲染，支持 ANSI 颜色">
      <TerminalPanel :search="activeSearch" :height="420" :sse-enabled="true" />
    </TestCard>
  </TestLayout>
</template>

<script setup lang="ts">
import { ref } from "vue";
import TestLayout from "@/modules/test/components/TestLayout.vue";
import TestCard from "@/modules/test/components/TestCard.vue";
import TerminalPanel from "@/components/TerminalPanel.vue";

const searchInput = ref("");
const activeSearch = ref("");

const handleConnect = () => {
  activeSearch.value = searchInput.value.trim() || " ";
};

const handleDisconnect = () => {
  activeSearch.value = "";
};
</script>
