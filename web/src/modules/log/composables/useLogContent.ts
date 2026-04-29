import { ref, type Ref, type ComputedRef, onUnmounted } from "vue";
import { logApi, API_BASE } from "@/api";
import { useSseBuffer } from "@/composables/useSseBuffer";
import type { LogFile } from "../types";

const LINES_PER_PAGE = 1000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiResponse = any;

/** 日志内容加载 + SSE + 分页 */
export function useLogContent(
  selectedFile: Ref<LogFile | null>,
  getFilterParams: () => string,
  getFilterParamsObject: () => Record<string, string>,
  smartScroll: () => void,
) {
  const logLines = ref<string[]>([]);
  const isLoadingContent = ref(false);
  const isLoadingMore = ref(false);
  const isLoadingNew = ref(false);
  const currentOffset = ref(0);
  const hasMoreLines = ref(false);
  const hasNewLines = ref(false);
  const newLinesCount = ref(0);
  const isConnected = ref(true);

  let pollTimer: ReturnType<typeof setInterval> | null = null;
  // SSE 实时行缓冲 — 批量刷新，减少渲染频率
  let sseLiveBuffer: string[] = [];
  let sseFlushTimer: ReturnType<typeof setTimeout> | null = null;
  const SSE_FLUSH_INTERVAL = 300; // ms

  const {
    connect: _connectSse,
    close: disconnectSse,
    startBuffer,
    flushBuffer,
  } = useSseBuffer({
    autoReconnect: true,
    onOpen: () => {
      isConnected.value = true;
    },
    onLine: (line) => {
      sseLiveBuffer.push(line);
      if (!sseFlushTimer) {
        sseFlushTimer = setTimeout(flushLiveBuffer, SSE_FLUSH_INTERVAL);
      }
    },
    onError: () => {
      isConnected.value = false;
    },
    onClose: () => {
      isConnected.value = false;
    },
  });

  /** 连接 SSE */
  function connectSSE() {
    disconnectSSE();
    if (!selectedFile.value) return;

    const filterParams = getFilterParams();
    const url = `${API_BASE}/logs/${selectedFile.value.name}/sse${filterParams ? "?" + filterParams : ""}`;
    _connectSse(url);
  }

  /** 刷新 SSE 实时缓冲到 logLines */
  function flushLiveBuffer() {
    sseFlushTimer = null;
    if (sseLiveBuffer.length === 0) return;
    const newLines = sseLiveBuffer;
    sseLiveBuffer = [];
    logLines.value.push(...newLines);
    if (selectedFile.value) {
      selectedFile.value = {
        ...selectedFile.value,
        totalLines: (selectedFile.value.totalLines || 0) + newLines.length,
      };
    }
    smartScroll();
  }

  /** 断开 SSE */
  function disconnectSSE() {
    disconnectSse();
    flushLiveBuffer();
    isConnected.value = false;
  }

  /** 开始 SSE 缓冲 */
  function startSSEBuffer() {
    startBuffer();
  }

  /** 刷新 SSE 缓冲 */
  function flushSSEBuffer() {
    flushBuffer(logLines, { deduplicate: true, dedupWindow: 200 });
  }

  /** 加载日志内容（初始加载） */
  async function loadLogContent(scrollToBottomFn: () => void) {
    if (!selectedFile.value) return;
    isLoadingContent.value = true;
    try {
      const data = (await logApi.getContent(selectedFile.value.name, {
        lines: LINES_PER_PAGE,
        offset: currentOffset.value,
        ...getFilterParamsObject(),
      })) as ApiResponse;
      if (data.success) {
        logLines.value = data.data.lines;
        if (selectedFile.value) {
          selectedFile.value = { ...selectedFile.value, totalLines: data.data.totalLines };
        }
        hasMoreLines.value = data.data.totalLines > LINES_PER_PAGE;
        setTimeout(() => {
          scrollToBottomFn();
        }, 100);
      }
    } catch {
      // 错误由调用方处理
    } finally {
      isLoadingContent.value = false;
    }
  }

  /** 加载更多历史日志 */
  async function loadMoreLines(containerRef: HTMLElement | null) {
    if (isLoadingMore.value || !selectedFile.value) return;
    isLoadingMore.value = true;

    const prevScrollHeight = containerRef?.scrollHeight || 0;
    currentOffset.value += LINES_PER_PAGE;

    try {
      const data = (await logApi.getContent(selectedFile.value.name, {
        lines: LINES_PER_PAGE,
        offset: currentOffset.value,
        ...getFilterParamsObject(),
      })) as ApiResponse;
      if (data.success) {
        logLines.value.unshift(...data.data.lines);
        hasMoreLines.value = currentOffset.value + LINES_PER_PAGE < data.data.totalLines;

        setTimeout(() => {
          if (containerRef) {
            const newScrollHeight = containerRef.scrollHeight;
            const heightAdded = newScrollHeight - prevScrollHeight;
            containerRef.scrollTop = heightAdded;
          }
        }, 10);
      }
    } catch {
      // 忽略
    } finally {
      isLoadingMore.value = false;
    }
  }

  /** 获取最后显示的行号 */
  function getLastDisplayedLineNumber() {
    const total = selectedFile.value?.totalLines || 0;
    const currentCount = logLines.value.length;
    return total - currentCount + logLines.value.length;
  }

  /** 加载最新日志 */
  async function loadNewLines(containerRef: HTMLElement | null, shouldAutoScroll: boolean, isNearBottom: boolean) {
    if (!selectedFile.value || isLoadingNew.value) return;
    isLoadingNew.value = true;
    try {
      const lastLineNum = getLastDisplayedLineNumber();
      const data = (await logApi.getContent(selectedFile.value.name, {
        lines: LINES_PER_PAGE,
        after: lastLineNum,
        ...getFilterParamsObject(),
      })) as ApiResponse;
      if (data.success && data.data.lines.length > 0) {
        const prevScrollHeight = containerRef?.scrollHeight || 0;
        const prevScrollTop = containerRef?.scrollTop || 0;

        logLines.value.push(...data.data.lines);
        if (selectedFile.value) {
          selectedFile.value = { ...selectedFile.value, totalLines: data.data.totalLines };
        }

        if (shouldAutoScroll && isNearBottom) {
          setTimeout(() => {
            if (containerRef) {
              containerRef.scrollTo({ top: containerRef.scrollHeight, behavior: "smooth" });
            }
          }, 10);
        } else {
          setTimeout(() => {
            if (containerRef) {
              const newScrollHeight = containerRef.scrollHeight;
              const heightDiff = newScrollHeight - prevScrollHeight;
              containerRef.scrollTop = prevScrollTop + heightDiff;
            }
          }, 10);
        }
        hasNewLines.value = false;
        newLinesCount.value = 0;
      }
    } catch (err) {
      console.error("加载新日志失败:", err);
    } finally {
      isLoadingNew.value = false;
    }
  }

  /** 检查是否有新日志行 */
  async function checkForNewLines(shouldAutoScroll: boolean, isNearBottom: boolean, containerRef: HTMLElement | null) {
    if (!selectedFile.value) return;
    try {
      const data = (await logApi.getStatus(selectedFile.value.name, getFilterParamsObject())) as ApiResponse;
      if (data.success) {
        const currentTotal = selectedFile.value.totalLines || 0;
        const serverTotal = data.data.totalLines;
        if (serverTotal > currentTotal) {
          hasNewLines.value = true;
          newLinesCount.value = serverTotal - currentTotal;
          if (shouldAutoScroll && isNearBottom) {
            await loadNewLines(containerRef, shouldAutoScroll, isNearBottom);
          }
        }
      }
    } catch (err) {
      console.error("检查新日志失败:", err);
    }
  }

  /** 开始轮询检查新日志 */
  function startPolling(
    autoScrollRef: Ref<boolean>,
    isUserNearBottomRef: Ref<boolean>,
    containerRefRef: Ref<HTMLElement | null> | ComputedRef<HTMLElement | null>,
  ) {
    stopPolling();
    pollTimer = setInterval(() => {
      checkForNewLines(autoScrollRef.value, isUserNearBottomRef.value, containerRefRef.value);
    }, 30000);
  }

  /** 停止轮询 */
  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  /** 重置内容状态 */
  function resetContent() {
    logLines.value = [];
    currentOffset.value = 0;
    hasMoreLines.value = false;
    hasNewLines.value = false;
    newLinesCount.value = 0;
  }

  onUnmounted(() => {
    disconnectSSE();
    stopPolling();
  });

  return {
    logLines,
    isLoadingContent,
    isLoadingMore,
    isLoadingNew,
    hasMoreLines,
    hasNewLines,
    newLinesCount,
    isConnected,
    currentOffset,
    connectSSE,
    disconnectSSE,
    startSSEBuffer,
    flushSSEBuffer,
    loadLogContent,
    loadMoreLines,
    loadNewLines,
    checkForNewLines,
    startPolling,
    stopPolling,
    resetContent,
  };
}
