/**
 * 进度模拟工具
 *
 * - startProgressSimulator : 启动后台定时器，在 HTTP 请求等待期间持续累加进度（有状态）
 * - calcTimeBasedProgress  : 按已耗时比例推算进度（无状态，适合 poll 轮次间调用）
 */

export interface SimulateProgressOptions {
  /** 起始进度（含） */
  from: number;
  /** 进度上限（含，通常为 90） */
  to: number;
  /** 预计总耗时（毫秒） */
  estimatedMs: number;
  /** 每次 tick 回调，参数为新进度值 */
  onProgress: (progress: number) => Promise<void> | void;
  /**
   * 最小 tick 间隔（毫秒），防止写入过于频繁。
   * 默认 1000ms（每秒至多写一次）。
   */
  minTickMs?: number;
}

export interface ProgressSimulator {
  /** 停止模拟（幂等） */
  stop: () => void;
  /** 获取当前模拟进度值 */
  current: () => number;
}

/**
 * 启动进度模拟定时器。
 *
 * 根据 `estimatedMs / (to - from)` 计算每 1% 所需时间作为 tick 间隔
 * （不低于 `minTickMs`），每次 tick 将进度 +1 并调用 `onProgress`。
 * 进度到达 `to` 或调用 `stop()` 后自动停止。
 */
export function startProgressSimulator(opts: SimulateProgressOptions): ProgressSimulator {
  const { from, to, estimatedMs, onProgress, minTickMs = 1000 } = opts;
  const range = to - from;
  if (range <= 0) return { stop: () => {}, current: () => from };

  const tickMs = Math.max(Math.floor(estimatedMs / range), minTickMs);
  let current = from;
  let stopped = false;
  let timer: ReturnType<typeof setInterval> | null = null;

  timer = setInterval(async () => {
    if (stopped || current >= to) {
      if (timer) { clearInterval(timer); timer = null; }
      return;
    }
    current = Math.min(current + 1, to);
    try {
      await onProgress(current);
    } catch {
      // 忽略进度写入错误，不中断主流程
    }
    if (current >= to && timer) {
      clearInterval(timer);
      timer = null;
    }
  }, tickMs);

  return {
    stop: () => {
      stopped = true;
      if (timer) { clearInterval(timer); timer = null; }
    },
    current: () => current,
  };
}

/**
 * 无状态进度推算：按已耗时在 `[from, to]` 区间内线性插值。
 *
 * 适用于 poll 任务——每次 poll 被调度时调用，根据轮询开始时间计算当前应有的模拟进度。
 *
 * @param startedAt   阶段开始时间戳（毫秒，`Date.now()` 格式）
 * @param estimatedMs 预计总耗时（毫秒）
 * @param from        进度下限（轮询入口，通常为 30）
 * @param to          进度上限（通常为 90）
 */
export function calcTimeBasedProgress(
  startedAt: number,
  estimatedMs: number,
  from: number,
  to: number,
): number {
  if (estimatedMs <= 0) return from;
  const elapsed = Date.now() - startedAt;
  const ratio = Math.min(elapsed / estimatedMs, 1);
  return Math.floor(from + ratio * (to - from));
}
