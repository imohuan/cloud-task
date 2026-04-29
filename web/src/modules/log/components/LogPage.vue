<template>
  <main class="flex h-screen flex-col overflow-hidden bg-slate-50">
    <!-- 顶部导航栏 -->
    <header
      class="sticky top-0 z-40 flex h-14 w-full items-center justify-between border-b border-slate-200 bg-white/80 px-6 backdrop-blur-md"
    >
      <div class="flex items-center gap-4">
        <!-- Logo -->
        <div class="mr-4 flex items-center gap-3">
          <div class="flex h-8 w-8 items-center justify-center rounded bg-blue-600 text-white">
            <TerminalRound class="h-5 w-5" />
          </div>
          <div>
            <h1 class="text-base leading-none font-bold text-slate-900">日志</h1>
          </div>
        </div>

        <!-- 文件下拉选择 -->
        <LogFileDropdown
          :is-open="isDropdownOpen"
          :selected-file="selectedFile"
          :log-files="logFiles"
          :is-loading="isLoading"
          :is-connected="isConnected"
          @toggle="toggleDropdown"
          @select="handleSelectFile"
        />

        <!-- 文件信息 -->
        <template v-if="selectedFile">
          <div class="h-4 w-px bg-slate-200"></div>
          <div class="flex items-center gap-2">
            <span class="text-xs font-medium text-slate-500">{{ selectedFile.sizeFormatted }}</span>
            <span class="text-xs text-slate-400">·</span>
            <span class="text-xs font-medium text-slate-500">{{ selectedFile.totalLines || 0 }} 行</span>
          </div>
        </template>
      </div>

      <div class="flex items-center gap-6">
        <!-- 搜索配置 -->
        <LogSearchPanel
          :is-open="isSearchPanelOpen"
          :search-list="searchList"
          :exclude-list="excludeList"
          :search-input="searchInput"
          :exclude-input="excludeInput"
          @toggle="toggleSearchPanel"
          @add-search="addSearchTerm"
          @remove-search="removeSearchTerm"
          @add-exclude="addExcludeTerm"
          @remove-exclude="removeExcludeTerm"
          @update:search-input="searchInput = $event"
          @update:exclude-input="excludeInput = $event"
          @apply="handleSearch"
        />

        <!-- 日志级别筛选 -->
        <LogLevelFilter :active-level-filters="activeLevelFilters" @toggle="handleToggleLevel" />

        <!-- 操作按钮 -->
        <div class="flex items-center gap-3">
          <button
            @click="refreshLogs"
            :disabled="isLoading"
            class="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-500 transition-all duration-200 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshRound class="h-4 w-4" :class="isLoading ? 'animate-spin' : ''" />
          </button>
          <button
            @click="scrollToBottom"
            class="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-blue-700"
          >
            <VerticalAlignBottomRound class="h-4 w-4" />
            <span>底部</span>
          </button>
        </div>
      </div>
    </header>

    <!-- 日志内容区域 -->
    <div class="flex-1 overflow-hidden bg-slate-50 p-3 px-6 py-3">
      <LogViewer
        ref="logViewerRef"
        :log-lines="logLines"
        :has-file="!!selectedFile"
        :is-loading-content="isLoadingContent"
        :is-loading-more="isLoadingMore"
        :is-loading-new="isLoadingNew"
        :has-more-lines="hasMoreLines"
        :has-new-lines="hasNewLines"
        :new-lines-count="newLinesCount"
        :is-connected="isConnected"
        :is-user-near-bottom="isUserNearBottom"
        v-model:auto-scroll="autoScroll"
        v-model:wrap-lines="wrapLines"
        :total-lines="selectedFile?.totalLines || 0"
        :active-level-filters="activeLevelFilters"
        @scroll="handleScroll"
        @download="downloadLog"
        @load-more="handleLoadMore"
        @load-new="handleLoadNew"
        @scroll-to-bottom="scrollToBottom"
        @contextmenu="handleContextMenu"
      />
    </div>

    <!-- Toast 通知 -->
    <div class="fixed right-4 bottom-4 z-50">
      <TransitionGroup name="fade">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          class="mb-2 flex min-w-[240px] items-center gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg"
          :class="
            toast.type === 'error'
              ? 'border-red-200 bg-red-50 text-red-700'
              : 'border-slate-200 bg-white text-slate-700'
          "
        >
          <component
            :is="toast.type === 'error' ? CancelRound : CheckCircleRound"
            class="h-4 w-4 shrink-0"
            :class="toast.type === 'error' ? 'text-red-500' : 'text-emerald-500'"
          />
          <span class="flex-1">{{ toast.message }}</span>
        </div>
      </TransitionGroup>
    </div>

    <!-- 右键菜单 -->
    <LogContextMenu
      :visible="contextMenuVisible"
      :x="contextMenuX"
      :y="contextMenuY"
      @add-to-search="addSelectionToSearch"
      @add-to-exclude="addSelectionToExclude"
    />

    <!-- 点击外部关闭浮层 -->
    <div v-if="isDropdownOpen || isSearchPanelOpen" @click="closeAllPanels" class="fixed inset-0 z-30"></div>
  </main>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { TerminalRound, RefreshRound, VerticalAlignBottomRound, CancelRound, CheckCircleRound } from "@vicons/material";
import LogFileDropdown from "./LogFileDropdown.vue";
import LogSearchPanel from "./LogSearchPanel.vue";
import LogLevelFilter from "./LogLevelFilter.vue";
import LogViewer from "./LogViewer.vue";
import LogContextMenu from "./LogContextMenu.vue";
import { useLogFiles } from "../composables/useLogFiles";
import { useLogFilter } from "../composables/useLogFilter";
import { useLogContent } from "../composables/useLogContent";
import { useLogScroll } from "../composables/useLogScroll";
import { useLogToast } from "../composables/useLogToast";
import type { LogFile } from "../types";

// ---- 文件列表管理 ----
const { logFiles, selectedFile, isLoading, refreshLogs, selectLogFile } = useLogFiles();

// ---- 筛选管理 ----
const {
  searchList,
  excludeList,
  searchInput,
  excludeInput,
  activeLevelFilters,
  isSearchPanelOpen,
  buildFilterParams,
  buildFilterParamsObject,
  toggleLevelFilter,
  addSearchTerm,
  removeSearchTerm,
  addExcludeTerm,
  removeExcludeTerm,
  updateUrlQuery,
  parseUrlQuery,
} = useLogFilter();

// ---- 滚动管理 ----
const logViewerRef = ref<InstanceType<typeof LogViewer> | null>(null);
const autoScroll = ref(true);
const wrapLines = ref(false);

// 日志容器元素引用（从 LogViewer 组件获取）
const logContainerEl = computed(() => logViewerRef.value?.containerRef ?? null);

const { isUserNearBottom, scrollToBottom, handleScroll, smartScroll } = useLogScroll({
  autoScroll,
  containerRef: logContainerEl,
});

// ---- 内容管理 ----
const {
  logLines,
  isLoadingContent,
  isLoadingMore,
  isLoadingNew,
  hasMoreLines,
  hasNewLines,
  newLinesCount,
  isConnected,
  connectSSE,
  disconnectSSE,
  startSSEBuffer,
  flushSSEBuffer,
  loadLogContent,
  loadMoreLines,
  loadNewLines,
  startPolling,
  stopPolling,
  resetContent,
} = useLogContent(selectedFile, buildFilterParams, buildFilterParamsObject, smartScroll);

// ---- Toast ----
const { toasts, showToast } = useLogToast();

// ---- 下拉状态 ----
const isDropdownOpen = ref(false);

// ---- 右键菜单 ----
const contextMenuVisible = ref(false);
const contextMenuX = ref(0);
const contextMenuY = ref(0);
const selectedText = ref("");

// ---- 方法 ----

function toggleDropdown() {
  isDropdownOpen.value = !isDropdownOpen.value;
  if (isDropdownOpen.value) isSearchPanelOpen.value = false;
}

function toggleSearchPanel() {
  isSearchPanelOpen.value = !isSearchPanelOpen.value;
  if (isSearchPanelOpen.value) isDropdownOpen.value = false;
}

function closeAllPanels() {
  isDropdownOpen.value = false;
  isSearchPanelOpen.value = false;
}

async function handleSelectFile(file: LogFile) {
  selectLogFile(file);
  isDropdownOpen.value = false;
  resetContent();
  updateUrlQuery(file.name);
  startSSEBuffer();
  connectSSE();
  await loadLogContent(scrollToBottom);
  flushSSEBuffer();
  startPolling(autoScroll, isUserNearBottom, logContainerEl);
}

async function handleSearch() {
  if (!selectedFile.value) return;
  resetContent();
  updateUrlQuery(selectedFile.value.name);
  startSSEBuffer();
  connectSSE();
  await loadLogContent(scrollToBottom);
  flushSSEBuffer();
}

function handleToggleLevel(level: string) {
  toggleLevelFilter(level as "DEBUG" | "INFO" | "WARN" | "ERROR");
  handleSearch();
}

async function handleLoadMore() {
  await loadMoreLines(logContainerEl.value);
}

async function handleLoadNew() {
  await loadNewLines(logContainerEl.value, autoScroll.value, isUserNearBottom.value);
}

function downloadLog() {
  if (!selectedFile.value) return;
  const blob = new Blob([logLines.value.join("\n")], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = selectedFile.value.name;
  a.click();
  URL.revokeObjectURL(url);
  showToast("下载已开始");
}

function handleContextMenu(event: MouseEvent) {
  const selection = window.getSelection()?.toString().trim();
  if (!selection) {
    contextMenuVisible.value = false;
    return;
  }
  selectedText.value = selection;
  contextMenuX.value = event.clientX;
  contextMenuY.value = event.clientY;
  contextMenuVisible.value = true;
}

function hideContextMenu() {
  contextMenuVisible.value = false;
}

function addSelectionToSearch() {
  const text = selectedText.value.trim();
  if (text && !searchList.value.includes(text)) {
    searchList.value.push(text);
    handleSearch();
  }
  hideContextMenu();
}

function addSelectionToExclude() {
  const text = selectedText.value.trim();
  if (text && !excludeList.value.includes(text)) {
    excludeList.value.push(text);
    handleSearch();
  }
  hideContextMenu();
}

// ---- 生命周期 ----

let refreshInterval: ReturnType<typeof setInterval> | null = null;

onMounted(async () => {
  parseUrlQuery();

  const result = await refreshLogs();
  if (!result) {
    showToast("加载日志文件失败", "error");
  }

  // 从 URL 恢复文件选择
  const fileParam = new URLSearchParams(window.location.search).get("file");
  if (fileParam) {
    const target = logFiles.value.find((f) => f.name === fileParam);
    if (target) {
      await handleSelectFile(target);
      return;
    }
  }

  // 默认选择第一个文件
  const firstFile = logFiles.value[0];
  if (firstFile && !selectedFile.value) {
    await handleSelectFile(firstFile);
  }

  // 定时刷新文件列表
  refreshInterval = setInterval(refreshLogs, 30000);

  document.addEventListener("click", hideContextMenu);
  isUserNearBottom.value = true;
});

onUnmounted(() => {
  if (refreshInterval) clearInterval(refreshInterval);
  document.removeEventListener("click", hideContextMenu);
  disconnectSSE();
  stopPolling();
});
</script>

<style>
/* 下拉动画 */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.2s ease;
}
.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}

/* Toast 动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
