import { ref, type Ref } from "vue";
import { useSse } from "./useSse";

export interface SseBufferOptions {
  url?: string;
  autoReconnect?: boolean;
  onOpen?: () => void;
  onError?: (error: Event) => void;
  onClose?: () => void;
  /** 实时模式回调：非缓冲状态下每条 SSE 消息都会触发 */
  onLine?: (line: string) => void;
}

export interface SseBufferInstance {
  isConnected: Ref<boolean>;
  connect: (url: string) => void;
  close: () => void;
  startBuffer: () => void;
  flushBuffer: (target: Ref<string[]>, opts?: { deduplicate?: boolean; dedupWindow?: number }) => void;
  pushLine: (line: string) => void;
}

/**
 * 封装 SSE + 消息缓冲，支持两种模式：
 *
 * 模式 A - 手动缓冲（避免加载历史期间遗漏实时消息）：
 *   startBuffer();
 *   connect(url);
 *   await loadHistory();
 *   flushBuffer(logsRef);
 *
 * 模式 B - 实时推送（通过 onLine 回调自行处理，如批量刷新）：
 *   useSseBuffer({ onLine: (line) => { ... } });
 *   connect(url);
 */
export function useSseBuffer(options: SseBufferOptions = {}): SseBufferInstance {
  const { url: defaultUrl, autoReconnect = false, onOpen, onError, onClose, onLine } = options;

  const isConnected = ref(false);
  let buffer: string[] | null = null;

  const { connect: _connect, close: _close } = useSse({
    url: defaultUrl || "",
    autoReconnect,
    onOpen: () => {
      isConnected.value = true;
      onOpen?.();
    },
    onMessage: (event) => {
      try {
        const data = JSON.parse(event.data);
        const line: string = data.rawLine || String(event.data);
        pushLine(line);
      } catch {
        pushLine(String(event.data));
      }
    },
    onError: (err) => {
      isConnected.value = false;
      onError?.(err);
    },
    onClose: () => {
      isConnected.value = false;
      onClose?.();
    },
  });

  function startBuffer() {
    buffer = [];
  }

  function flushBuffer(target: Ref<string[]>, opts: { deduplicate?: boolean; dedupWindow?: number } = {}) {
    if (!buffer || buffer.length === 0) {
      buffer = null;
      return;
    }
    let lines = buffer;
    if (opts.deduplicate) {
      const windowSize = opts.dedupWindow ?? 200;
      const existing = new Set(target.value.slice(-windowSize));
      lines = lines.filter((l) => !existing.has(l));
    }
    if (lines.length > 0) {
      target.value.push(...lines);
    }
    buffer = null;
  }

  function pushLine(line: string) {
    if (buffer) {
      buffer.push(line);
    } else {
      onLine?.(line);
    }
  }

  function connect(url: string) {
    _close();
    _connect(url);
  }

  function close() {
    _close();
    isConnected.value = false;
    buffer = null;
  }

  return {
    isConnected,
    connect,
    close,
    startBuffer,
    flushBuffer,
    pushLine,
  };
}

export default useSseBuffer;
