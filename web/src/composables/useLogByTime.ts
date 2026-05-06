import { ref } from "vue";
import { logApi } from "@/api";

export interface LogByTimeParams {
  startTime: number;
  endTime?: number;
  offsetMinutes?: number;
  search?: string;
  exclude?: string;
  levels?: string;
  lines?: number;
}

export function useLogByTime() {
  const lines = ref<string[]>([]);
  const isLoading = ref(false);

  async function loadByTime(params: LogByTimeParams): Promise<string[]> {
    isLoading.value = true;
    try {
      const res = (await logApi.getByTime(params)) as unknown as {
        success: boolean;
        data: { lines: string[]; total: number };
      };
      if (res.success && res.data?.lines) {
        lines.value = res.data.lines;
        return res.data.lines;
      }
    } catch {
      // 加载失败静默处理
    } finally {
      isLoading.value = false;
    }
    return [];
  }

  function reset() {
    lines.value = [];
  }

  return { lines, isLoading, loadByTime, reset };
}
