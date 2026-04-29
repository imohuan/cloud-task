<template>
  <div>
    <div class="mb-2 flex items-center justify-between">
      <div class="flex items-center">
        <span class="text-[10px] font-bold tracking-widest text-slate-500 uppercase">执行流水 (Streaming Logs)</span>
        <span v-if="isLoadingHistory" class="ml-2 rounded bg-amber-500 px-1.5 py-0.5 text-[9px] font-bold text-white"
          >加载中</span
        >
        <span
          v-else-if="connected"
          class="ml-2 animate-pulse rounded bg-blue-500 px-1.5 py-0.5 text-[9px] font-bold text-white"
          >LIVE</span
        >
        <span
          v-else-if="logs.length > 0"
          class="ml-2 rounded bg-slate-300 px-1.5 py-0.5 text-[9px] font-bold text-white"
          >OFF</span
        >
      </div>
      <div class="flex items-center gap-2">
        <button
          v-if="logs.length > 0"
          class="text-[10px] text-slate-400 transition-colors hover:text-slate-600"
          @click="copyLogs"
        >
          {{ copied ? "已复制" : "复制" }}
        </button>
        <button
          v-if="search"
          class="text-[10px] text-slate-400 transition-colors hover:text-slate-600"
          @click="openLogs"
        >
          打开日志
        </button>
        <button
          v-if="logs.length > 0"
          class="text-[10px] text-slate-400 transition-colors hover:text-slate-600"
          @click="logs = []"
        >
          清空
        </button>
      </div>
    </div>
    <div
      class="overflow-hidden rounded-lg border border-slate-200 bg-[#fdfdfd] shadow-[inset_0_1px_4px_rgba(0,0,0,0.02)]"
      :style="{ height: `${height}px` }"
    >
      <div ref="terminalContainer" style="width: 100%; height: 100%" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from "vue";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { useSseBuffer } from "@/composables/useSseBuffer";
import { logApi, API_BASE } from "@/api";

const props = withDefaults(
  defineProps<{
    search?: string;
    file?: string;
    loadHistory?: boolean;
    height?: number;
    sseEnabled?: boolean;
  }>(),
  {
    sseEnabled: true,
  },
);

const DEFAULT_HEIGHT = 208;

const terminalContainer = ref<HTMLDivElement | null>(null);
const terminalInstance = ref<Terminal | null>(null);
const fitAddonInstance = ref<FitAddon | null>(null);
const logs = ref<string[]>([]);
const isLoadingHistory = ref(false);
const copied = ref(false);
let lastRenderedLen = 0;

const height = computed(() => props.height ?? DEFAULT_HEIGHT);

const openLogs = () => {
  if (props.search) {
    const params = new URLSearchParams();
    params.set("search", props.search);
    if (props.file) {
      params.set("file", props.file);
    }
    window.open(`/logs?${params.toString()}`, "_blank");
  }
};

const copyLogs = async () => {
  if (logs.value.length === 0) return;
  const text = logs.value.join("\n");
  try {
    await navigator.clipboard.writeText(text);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 1500);
  } catch {
    // 复制失败静默处理
  }
};

const {
  isConnected: connected,
  connect,
  close,
  startBuffer,
  flushBuffer,
} = useSseBuffer({
  onLine: (line) => {
    logs.value.push(line);
  },
});

const writeToTerminal = (line: string) => {
  const term = terminalInstance.value;
  if (!term) return;
  let coloredLine = line;
  if (/\bERROR\b/.test(line)) coloredLine = `\x1b[31m${line}\x1b[0m`;
  else if (/\bWARN\b/.test(line)) coloredLine = `\x1b[38;5;136m${line}\x1b[0m`;
  else if (/\bDEBUG\b/.test(line)) coloredLine = `\x1b[36m${line}\x1b[0m`;
  else if (/\bINFO\b/.test(line)) coloredLine = `\x1b[34m${line}\x1b[0m`;
  term.writeln(coloredLine);
};

const clearTerminal = () => {
  if (terminalInstance.value) {
    terminalInstance.value.clear();
  }
  lastRenderedLen = 0;
};

const initTerminal = () => {
  if (!terminalContainer.value || terminalInstance.value) return;

  const term = new Terminal({
    cursorStyle: "underline",
    cursorInactiveStyle: "none",
    cursorBlink: false,
    disableStdin: true,
    fontSize: 12,
    fontFamily: '"Fira Code", monospace',
    lineHeight: 1.4,
    theme: {
      background: "#fdfdfd",
      foreground: "#1e293b",
      cursor: "transparent",
      selectionBackground: "#e2e8f0",
    },
    scrollback: 2000,
    convertEol: true,
  });

  const fitAddon = new FitAddon();
  term.loadAddon(fitAddon);
  term.open(terminalContainer.value);
  fitAddon.fit();

  terminalInstance.value = term;
  fitAddonInstance.value = fitAddon;
};

const syncLogsToTerminal = () => {
  const term = terminalInstance.value;
  if (!term) return;
  const newLogs = logs.value;
  if (newLogs.length < lastRenderedLen) {
    clearTerminal();
    newLogs.forEach((l) => writeToTerminal(l));
  } else {
    for (let i = lastRenderedLen; i < newLogs.length; i++) {
      writeToTerminal(newLogs[i]!);
    }
  }
  lastRenderedLen = newLogs.length;
};

const handleResize = () => {
  if (fitAddonInstance.value) {
    fitAddonInstance.value.fit();
  }
};

const loadHistoryLogs = async (search: string) => {
  if (!search || !props.loadHistory) return;
  isLoadingHistory.value = true;
  try {
    if (props.file) {
      const contentRes = (await logApi.getContent(props.file, { search, lines: 500 })) as unknown as {
        success: boolean;
        data: { lines: string[] };
      };
      if (contentRes.success && contentRes.data?.lines?.length) {
        logs.value = contentRes.data.lines;
      }
      return;
    }

    const res = (await logApi.getFiles()) as unknown as {
      success: boolean;
      data: { files: Array<{ name: string; modifiedAt: string }> };
    };
    if (!res.success || !res.data?.files?.length) return;

    const recentFiles = [...res.data.files]
      .sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime())
      .slice(0, 5);

    const allLines: string[] = [];
    for (const file of recentFiles) {
      try {
        const contentRes = (await logApi.getContent(file.name, { search, lines: 500 })) as unknown as {
          success: boolean;
          data: { lines: string[] };
        };
        if (contentRes.success && contentRes.data?.lines?.length) {
          allLines.push(...contentRes.data.lines);
        }
      } catch {
        // 单个文件加载失败不影响整体
      }
    }

    if (allLines.length > 0) {
      logs.value = allLines;
    }
  } catch {
    // 历史日志加载失败静默处理
  } finally {
    isLoadingHistory.value = false;
  }
};

watch(
  () => props.search,
  async (newSearch, oldSearch) => {
    if (newSearch && newSearch !== oldSearch) {
      logs.value = [];
      lastRenderedLen = 0;
      clearTerminal();
      if (props.sseEnabled !== false) {
        startBuffer();
        const encodedSearch = encodeURIComponent(newSearch);
        const url = props.file
          ? `${API_BASE}/logs/${encodeURIComponent(props.file)}/sse?search=${encodedSearch}`
          : `${API_BASE}/logs/sse?search=${encodedSearch}`;
        connect(url);
      }
      await loadHistoryLogs(newSearch);
      await nextTick();
      initTerminal();
      syncLogsToTerminal();
      if (props.sseEnabled !== false) {
        flushBuffer(logs);
      }
    } else if (!newSearch) {
      close();
      logs.value = [];
      lastRenderedLen = 0;
      clearTerminal();
    }
  },
  { immediate: true },
);

watch(
  () => logs.value,
  () => {
    syncLogsToTerminal();
  },
  { deep: true },
);

onMounted(() => {
  nextTick(() => {
    initTerminal();
    syncLogsToTerminal();
  });
  window.addEventListener("resize", handleResize);
});

onUnmounted(() => {
  close();
  window.removeEventListener("resize", handleResize);
  if (terminalInstance.value) {
    terminalInstance.value.dispose();
    terminalInstance.value = null;
  }
});
</script>
