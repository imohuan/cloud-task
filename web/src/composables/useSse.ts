import { ref, onUnmounted } from "vue";

export interface SseOptions {
  /** 连接 URL */
  url: string;
  /** 收到消息回调 */
  onMessage?: (event: MessageEvent) => void;
  /** 连接成功回调 */
  onOpen?: () => void;
  /** 连接关闭回调（不会自动重连时触发） */
  onClose?: () => void;
  /** 发生错误回调 */
  onError?: (error: Event) => void;
  /** 心跳超时时间（ms），默认 45000。超过此时间未收到任何消息则主动重连 */
  heartbeatTimeout?: number;
  /** 自动重连延迟（ms），默认 3000 */
  reconnectDelay?: number;
  /** 最大重连延迟（ms），默认 30000 */
  maxReconnectDelay?: number;
  /** 重连退避倍数，默认 2 */
  reconnectBackoff?: number;
  /** 是否自动重连，默认 true */
  autoReconnect?: boolean;
  /** 最大重连次数，默认 Infinity */
  maxReconnectAttempts?: number;
  /** 自定义 EventSource init (withCredentials 等) */
  eventSourceInit?: EventSourceInit;
}

export interface SseInstance {
  /** 是否已连接 */
  isConnected: ReturnType<typeof ref<boolean>>;
  /** 是否正在连接 */
  isConnecting: ReturnType<typeof ref<boolean>>;
  /** 手动关闭（关闭后不会自动重连） */
  close: () => void;
  /** 手动连接 */
  connect: (overrideUrl?: string) => void;
}

/**
 * 封装 EventSource，支持：
 * - 自动重连（指数退避）
 * - 心跳超时检测（长时间未收到任何消息则主动重连）
 * - 组件卸载时自动清理
 *
 * SSE 是单向通道，只能由后端发心跳保活，前端通过心跳超时检测来识别“假死”连接。
 */
export function useSse(options: SseOptions): SseInstance {
  const {
    url,
    onMessage,
    onOpen,
    onClose,
    onError,
    heartbeatTimeout = 45000,
    reconnectDelay = 3000,
    maxReconnectDelay = 30000,
    reconnectBackoff = 2,
    autoReconnect = true,
    maxReconnectAttempts = Infinity,
    eventSourceInit,
  } = options;

  const isConnected = ref(false);
  const isConnecting = ref(false);

  let es: EventSource | null = null;
  let heartbeatTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnectAttempts = 0;
  let shouldReconnect = autoReconnect;
  let isDestroyed = false;

  const clearHeartbeat = () => {
    if (heartbeatTimer) {
      clearTimeout(heartbeatTimer);
      heartbeatTimer = null;
    }
  };

  const clearReconnect = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  const resetHeartbeat = () => {
    clearHeartbeat();
    heartbeatTimer = setTimeout(() => {
      // 心跳超时：长时间未收到任何消息，认为连接已死，主动关闭并重连
      console.warn("[SSE] 心跳超时，准备重连...", url);
      es?.close();
      es = null;
      isConnected.value = false;
      scheduleReconnect();
    }, heartbeatTimeout);
  };

  const scheduleReconnect = () => {
    if (!shouldReconnect || isDestroyed) return;
    if (reconnectAttempts >= maxReconnectAttempts) {
      console.warn("[SSE] 达到最大重连次数，放弃重连", url);
      isConnecting.value = false;
      onClose?.();
      return;
    }

    isConnecting.value = true;
    const delay = Math.min(reconnectDelay * Math.pow(reconnectBackoff, reconnectAttempts), maxReconnectDelay);
    reconnectAttempts++;

    console.info(`[SSE] ${delay}ms 后尝试第 ${reconnectAttempts} 次重连...`, url);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      if (!isDestroyed) {
        connect();
      }
    }, delay);
  };

  const connect = (overrideUrl?: string) => {
    if (es || isDestroyed) return;

    shouldReconnect = autoReconnect;
    clearReconnect();
    isConnecting.value = true;

    try {
      const targetUrl = overrideUrl || url;
      const source = new EventSource(targetUrl, eventSourceInit);
      es = source;

      source.onopen = () => {
        reconnectAttempts = 0;
        isConnected.value = true;
        isConnecting.value = false;
        resetHeartbeat();
        onOpen?.();
      };

      // 监听默认消息
      source.onmessage = (event) => {
        resetHeartbeat();
        onMessage?.(event);
      };

      // 监听后端心跳 ping 事件（只用于保活，不触发 onMessage）
      source.addEventListener("ping", () => {
        resetHeartbeat();
      });

      source.onerror = (error) => {
        isConnected.value = false;
        isConnecting.value = false;
        es = null;
        clearHeartbeat();
        onError?.(error);
        if (shouldReconnect && !isDestroyed) {
          scheduleReconnect();
        } else {
          onClose?.();
        }
      };
    } catch (err) {
      isConnecting.value = false;
      es = null;
      onError?.(err as Event);
      if (shouldReconnect && !isDestroyed) {
        scheduleReconnect();
      }
    }
  };

  const close = () => {
    shouldReconnect = false;
    clearHeartbeat();
    clearReconnect();
    if (es) {
      es.close();
      es = null;
    }
    isConnected.value = false;
    isConnecting.value = false;
    onClose?.();
  };

  onUnmounted(() => {
    isDestroyed = true;
    close();
  });

  // 如果开启自动重连，立即尝试连接
  if (autoReconnect) {
    connect();
  }

  return {
    isConnected,
    isConnecting,
    connect,
    close,
  };
}

export default useSse;
