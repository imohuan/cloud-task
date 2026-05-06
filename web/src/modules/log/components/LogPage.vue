<template>
  <main class="flex h-screen flex-col overflow-hidden bg-slate-50">
    <!-- 顶部导航栏 -->
    <header
      class="sticky top-0 z-40 flex h-14 w-full items-center justify-between border-b border-slate-200 bg-white/80 backdrop-blur-md"
      :class="isMobile ? 'px-3' : 'px-6'">
      <div class="flex min-w-0 flex-1 items-center" :class="isMobile ? 'gap-2' : 'gap-4'">
        <!-- Logo -->
        <div class="flex shrink-0 items-center gap-3" :class="isMobile ? 'mr-1' : 'mr-4'">
          <div class="flex h-8 w-8 items-center justify-center rounded bg-blue-600 text-white">
            <TerminalRound class="h-5 w-5" />
          </div>
          <div>
            <h1 class="text-base leading-none font-bold text-slate-900">日志</h1>
          </div>
        </div>

        <!-- 文件下拉选择（文件模式） -->
        <LogFileDropdown v-if="!isTimeMode" :is-open="isDropdownOpen" :selected-file="selectedFile"
          :log-files="logFiles" :is-loading="isLoading" :is-connected="isConnected" @toggle="toggleDropdown"
          @select="handleSelectFile" />
        <!-- 时间模式标签 -->
        <div v-else
          class="flex min-w-0 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5">
          <span class="shrink-0 text-xs font-semibold text-blue-600">时间范围</span>
          <span class="truncate text-xs text-blue-500" :class="isMobile ? 'max-w-[160px]' : ''">
            {{ timeStartMs !== undefined ? (isMobile ? formatTimestampMobile(timeStartMs) :
              formatTimestamp(timeStartMs)) : '' }}
            <template v-if="timeEndMs !== undefined"> — {{ isMobile ? formatTimestampMobile(timeEndMs) :
              formatTimestamp(timeEndMs) }}</template>
            <template v-else> — 至今</template>
          </span>
        </div>

        <!-- 文件信息（文件模式） -->
        <template v-if="!isTimeMode && selectedFile && !isMobile">
          <div class="h-4 w-px bg-slate-200"></div>
          <div class="flex items-center gap-2">
            <span class="text-xs font-medium text-slate-500">{{ selectedFile.sizeFormatted }}</span>
            <span class="text-xs text-slate-400">·</span>
            <span class="text-xs font-medium text-slate-500">{{ selectedFile.totalLines || 0 }} 行</span>
          </div>
        </template>
        <!-- 时间模式行数信息 -->
        <template v-else-if="isTimeMode && !isMobile">
          <div class="h-4 w-px bg-slate-200"></div>
          <span class="text-xs font-medium text-slate-500">{{ timeLines.length }} 行</span>
        </template>
      </div>

      <div v-if="!isMobile" class="flex items-center gap-6">
        <!-- 搜索配置 -->
        <LogSearchPanel :is-open="isSearchPanelOpen" :search-list="searchList" :exclude-list="excludeList"
          :search-input="searchInput" :exclude-input="excludeInput" :active-level-filters="activeLevelFilters"
          @toggle="toggleSearchPanel" @add-search="addSearchTerm" @remove-search="removeSearchTerm"
          @add-exclude="addExcludeTerm" @remove-exclude="removeExcludeTerm" @update:search-input="searchInput = $event"
          @update:exclude-input="excludeInput = $event" @apply="handleSearch" @toggle-level="handleToggleLevel" />

        <!-- 操作按钮 -->
        <div class="flex items-center gap-3">
          <button @click="handleRefresh" :disabled="isTimeMode ? isTimeLoading : isLoading"
            class="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-500 transition-all duration-200 hover:bg-slate-50 disabled:opacity-50">
            <RefreshRound class="h-4 w-4" :class="(isTimeMode ? isTimeLoading : isLoading) ? 'animate-spin' : ''" />
          </button>
          <button @click="scrollToBottom"
            class="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-blue-700">
            <VerticalAlignBottomRound class="h-4 w-4" />
            <span>底部</span>
          </button>
        </div>
      </div>

      <!-- Mobile: 菜单按钮 -->
      <button v-else @click="toggleMobileMenu"
        class="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-slate-100"
        :class="isMobileMenuOpen ? 'bg-slate-100 text-slate-700' : 'text-slate-500'">
        <TuneRound class="h-5 w-5" />
      </button>
    </header>

    <!-- Mobile 下拉操作面板 -->
    <Transition name="dropdown">
      <div v-if="isMobile && isMobileMenuOpen"
        class="fixed top-14 left-0 right-0 z-35 rounded-b-xl border border-slate-200 bg-white/95 shadow-lg backdrop-blur-md">
        <!-- 搜索配置（内联） -->
        <div class="px-3 py-3">
          <LogSearchForm :compact="true" :search-list="searchList" :exclude-list="excludeList"
            :search-input="searchInput" :exclude-input="excludeInput" @add-search="addSearchTerm"
            @remove-search="removeSearchTerm" @add-exclude="addExcludeTerm" @remove-exclude="removeExcludeTerm"
            @update:search-input="searchInput = $event" @update:exclude-input="excludeInput = $event"
            @apply="handleSearch">
            <template #above-apply>
              <label class="mb-1.5 block text-[11px] font-bold tracking-wider text-slate-400 uppercase">日志级别</label>
              <LogLevelFilter :active-level-filters="activeLevelFilters" @toggle="handleToggleLevel" />
            </template>
            <template #apply-extra>
              <button @click="handleRefresh" :disabled="isTimeMode ? isTimeLoading : isLoading"
                class="flex items-center justify-center rounded-lg border border-slate-200 px-3 py-1.5 text-slate-500 transition-all hover:bg-slate-50 disabled:opacity-50">
                <RefreshRound class="h-4 w-4" :class="(isTimeMode ? isTimeLoading : isLoading) ? 'animate-spin' : ''" />
              </button>
            </template>
          </LogSearchForm>
        </div>
      </div>
    </Transition>

    <!-- 日志内容区域 -->
    <div class="flex-1 overflow-hidden bg-slate-50" :class="isMobile ? 'p-1' : 'px-6 py-3'">
      <LogViewer ref="logViewerRef" :log-lines="isTimeMode ? timeLines : logLines"
        :has-file="isTimeMode ? true : !!selectedFile"
        :is-loading-content="isTimeMode ? isTimeLoading : isLoadingContent"
        :is-loading-more="isTimeMode ? false : isLoadingMore" :is-loading-new="isTimeMode ? false : isLoadingNew"
        :has-more-lines="isTimeMode ? false : hasMoreLines" :has-new-lines="isTimeMode ? false : hasNewLines"
        :new-lines-count="isTimeMode ? 0 : newLinesCount" :is-connected="isTimeMode ? false : isConnected"
        :is-user-near-bottom="isUserNearBottom" v-model:auto-scroll="autoScroll" v-model:wrap-lines="wrapLines"
        :total-lines="isTimeMode ? timeLines.length : (selectedFile?.totalLines || 0)"
        :active-level-filters="activeLevelFilters" @scroll="handleScroll" @download="downloadLog"
        @load-more="handleLoadMore" @load-new="handleLoadNew" @scroll-to-bottom="scrollToBottom"
        @contextmenu="handleContextMenu" />
    </div>

    <!-- Toast 通知 -->
    <div class="fixed right-4 bottom-4 z-50">
      <TransitionGroup name="fade">
        <div v-for="toast in toasts" :key="toast.id"
          class="mb-2 flex min-w-[240px] items-center gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg" :class="toast.type === 'error'
              ? 'border-red-200 bg-red-50 text-red-700'
              : 'border-slate-200 bg-white text-slate-700'
            ">
          <component :is="toast.type === 'error' ? CancelRound : CheckCircleRound" class="h-4 w-4 shrink-0"
            :class="toast.type === 'error' ? 'text-red-500' : 'text-emerald-500'" />
          <span class="flex-1">{{ toast.message }}</span>
        </div>
      </TransitionGroup>
    </div>

    <!-- 右键菜单 -->
    <LogContextMenu :visible="contextMenuVisible" :x="contextMenuX" :y="contextMenuY"
      :is-multiline="selectedText.includes('\n')" @add-to-search="addSelectionToSearch"
      @add-to-exclude="addSelectionToExclude" @copy="copySelection" @close="hideContextMenu" />

    <!-- 点击外部关闭浮层 -->
    <div v-if="isDropdownOpen || isSearchPanelOpen || isMobileMenuOpen" @click="closeAllPanels"
      class="fixed inset-0 z-30">
    </div>
  </main>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from "vue";
import { useRoute } from "vue-router";
import { TerminalRound, RefreshRound, VerticalAlignBottomRound, CancelRound, CheckCircleRound, TuneRound } from "@vicons/material";
import LogFileDropdown from "./LogFileDropdown.vue";
import LogSearchPanel from "./LogSearchPanel.vue";
import LogSearchForm from "./LogSearchForm.vue";
import LogLevelFilter from "./LogLevelFilter.vue";
import LogViewer from "./LogViewer.vue";
import LogContextMenu from "./LogContextMenu.vue";
import { useLogFiles } from "../composables/useLogFiles";
import { useLogFilter } from "../composables/useLogFilter";
import { useLogContent } from "../composables/useLogContent";
import { useLogScroll } from "../composables/useLogScroll";
import { useLogToast } from "../composables/useLogToast";
import { useLogByTime } from "@/composables/useLogByTime";
import { useAppStore } from "@/stores";
import type { LogFile } from "../types";

// ---- 时间模式 ----
const isTimeMode = ref(false);
const timeStartMs = ref<number | undefined>();
const timeEndMs = ref<number | undefined>();
const { lines: timeLines, isLoading: isTimeLoading, loadByTime } = useLogByTime();

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

// ---- 移动端 ----
const appStore = useAppStore();
const isMobile = computed(() => appStore.isMobile);
const isMobileMenuOpen = ref(false);

// ---- 滚动管理 ----
const logViewerRef = ref<InstanceType<typeof LogViewer> | null>(null);
const autoScroll = ref(true);
const wrapLines = ref(appStore.isMobile);

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

// ---- 路由 ----
const route = useRoute();
let isInternalNavigation = false;

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
  isMobileMenuOpen.value = false;
}

function toggleMobileMenu() {
  isMobileMenuOpen.value = !isMobileMenuOpen.value;
  if (isMobileMenuOpen.value) {
    isDropdownOpen.value = false;
    isSearchPanelOpen.value = false;
  }
}

async function handleSelectFile(file: LogFile, options?: { replace?: boolean }) {
  isInternalNavigation = true;
  selectLogFile(file);
  isDropdownOpen.value = false;
  resetContent();
  updateUrlQuery(file.name, options);
  startSSEBuffer();
  connectSSE();
  await loadLogContent(scrollToBottom);
  flushSSEBuffer();
  startPolling(autoScroll, isUserNearBottom, logContainerEl);
  await nextTick();
  isInternalNavigation = false;
}

async function handleSearch() {
  if (!selectedFile.value) return;
  isInternalNavigation = true;
  resetContent();
  updateUrlQuery(selectedFile.value.name);
  startSSEBuffer();
  connectSSE();
  await loadLogContent(scrollToBottom);
  flushSSEBuffer();
  await nextTick();
  isInternalNavigation = false;
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

async function copySelection() {
  const text = selectedText.value.trim();
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    showToast("已复制");
  } catch (e) {
    console.error("复制失败", e);
  }
  hideContextMenu();
}

// ---- 生命周期 ----

let refreshInterval: ReturnType<typeof setInterval> | null = null;

async function enterTimeMode(startMs: number, endMs?: number) {
  isTimeMode.value = true;
  timeStartMs.value = startMs;
  timeEndMs.value = endMs;
  await loadByTime({ startTime: startMs, endTime: endMs, ...buildFilterParamsObject() });
}

async function handleRefresh() {
  if (isTimeMode.value && timeStartMs.value !== undefined) {
    await loadByTime({
      startTime: timeStartMs.value,
      endTime: timeEndMs.value,
      ...buildFilterParamsObject(),
    });
    return;
  }
  const result = await refreshLogs();
  if (!result) showToast("加载日志文件失败", "error");
}

function formatTimestamp(ms: number): string {
  return new Date(ms).toLocaleString();
}

function formatTimestampMobile(ms: number): string {
  return new Date(ms).toLocaleTimeString();
}

onMounted(async () => {
  parseUrlQuery();

  // 检测时间模式
  const startParam = route.query.startTime as string | undefined;
  if (startParam) {
    const startMs = parseInt(startParam, 10);
    const endParam = route.query.endTime as string | undefined;
    const endMs = endParam ? parseInt(endParam, 10) : undefined;
    await enterTimeMode(startMs, endMs);
    return;
  }

  const result = await refreshLogs();
  if (!result) {
    showToast("加载日志文件失败", "error");
  }

  // 从 URL 恢复文件选择
  const fileParam = route.query.file as string | undefined;
  if (fileParam) {
    const target = logFiles.value.find((f) => f.name === fileParam);
    if (target) {
      await handleSelectFile(target, { replace: true });
      return;
    }
  }

  // 默认选择第一个文件
  const firstFile = logFiles.value[0];
  if (firstFile && !selectedFile.value) {
    await handleSelectFile(firstFile, { replace: true });
  }

  // 定时刷新文件列表
  refreshInterval = setInterval(refreshLogs, 30000);

  isUserNearBottom.value = true;
});

// 监听路由 query 变化（浏览器前进/后退触发）
watch(
  () => route.query,
  async () => {
    if (isInternalNavigation) return;
    parseUrlQuery();

    // 时间模式
    const startParam = route.query.startTime as string | undefined;
    if (startParam) {
      disconnectSSE();
      stopPolling();
      const startMs = parseInt(startParam, 10);
      const endParam = route.query.endTime as string | undefined;
      const endMs = endParam ? parseInt(endParam, 10) : undefined;
      await enterTimeMode(startMs, endMs);
      return;
    }

    // 文件模式
    isTimeMode.value = false;
    timeStartMs.value = undefined;
    timeEndMs.value = undefined;

    const fileParam = route.query.file as string | undefined;
    const target = fileParam
      ? logFiles.value.find((f) => f.name === fileParam)
      : logFiles.value[0];
    if (!target) return;
    selectLogFile(target);
    disconnectSSE();
    stopPolling();
    resetContent();
    startSSEBuffer();
    connectSSE();
    await loadLogContent(scrollToBottom);
    flushSSEBuffer();
    startPolling(autoScroll, isUserNearBottom, logContainerEl);
  },
  { deep: true },
);

onUnmounted(() => {
  if (refreshInterval) clearInterval(refreshInterval);
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
