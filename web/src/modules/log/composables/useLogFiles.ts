import { ref } from "vue";
import { logApi } from "@/api";
import type { LogFile } from "../types";

/** 日志文件列表管理 */
export function useLogFiles() {
  const logFiles = ref<LogFile[]>([]);
  const selectedFile = ref<LogFile | null>(null);
  const isLoading = ref(false);

  /** 拉取日志文件列表 */
  async function refreshLogs() {
    isLoading.value = true;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = (await logApi.getFiles()) as any;
      if (data.success) {
        logFiles.value = data.data.files;
        // 同步更新已选中文件的信息
        if (selectedFile.value) {
          const updated = logFiles.value.find((f) => f.name === selectedFile.value!.name);
          if (updated) {
            selectedFile.value = { ...selectedFile.value, ...updated };
          }
        }
      }
      return data;
    } catch {
      return null;
    } finally {
      isLoading.value = false;
    }
  }

  /** 选择日志文件 */
  function selectLogFile(file: LogFile) {
    selectedFile.value = file;
  }

  return { logFiles, selectedFile, isLoading, refreshLogs, selectLogFile };
}
