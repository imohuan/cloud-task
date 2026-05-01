import { reactive } from "vue";
import { API_BASE } from "@/utils/request";

export interface UploadTask {
  id: string;
  file: File;
  preview: string;
  status: "uploading" | "success" | "error";
  error?: string;
  remoteUrl?: string;
}

export interface UseImageUploadOptions {
  /** 上传接口地址，默认 https://imageproxy.zhongzhuan.chat/api/upload */
  uploadUrl?: string;
  /** 文件大小上限（字节），默认 10MB */
  maxSize?: number;
  /** 上传成功回调 */
  onSuccess?: (key: string, remoteUrl: string, task: UploadTask) => void;
  /** 上传失败回调 */
  onError?: (key: string, error: string, task: UploadTask) => void;
}

const uploadUrls = [
  `${API_BASE}/upload`,
  "https://imageproxy.zhongzhuan.chat/api/upload",
]

export function useImageUpload(options: UseImageUploadOptions = {}) {
  const effectiveUrls = options.uploadUrl ? [options.uploadUrl, ...uploadUrls] : uploadUrls;
  const maxSize = options.maxSize ?? 10 * 1024 * 1024;

  const uploadingMap = reactive<Record<string, UploadTask[]>>({});

  function generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }

  function createPreviewUrl(file: File): string {
    return URL.createObjectURL(file);
  }

  function validateFile(file: File): string | null {
    if (!file.type.startsWith("image/")) return "请选择图片文件";
    if (file.size > maxSize) return `图片大小不能超过 ${Math.round(maxSize / 1024 / 1024)}MB`;
    return null;
  }

  /** 获取某 key 下的所有上传任务 */
  function getTasks(key: string): UploadTask[] {
    return uploadingMap[key] ?? [];
  }

  /** 添加文件并开始上传，返回创建的 UploadTask 数组 */
  async function uploadFiles(key: string, files: File[]): Promise<UploadTask[]> {
    const validTasks: UploadTask[] = [];

    for (const file of files) {
      const err = validateFile(file);
      if (err) {
        // 仍然创建 task 标记为 error
        const task: UploadTask = {
          id: generateId(),
          file,
          preview: createPreviewUrl(file),
          status: "error",
          error: err,
        };
        if (!uploadingMap[key]) uploadingMap[key] = [];
        uploadingMap[key]!.push(task);
        options.onError?.(key, err, task);
        continue;
      }

      const task: UploadTask = {
        id: generateId(),
        file,
        preview: createPreviewUrl(file),
        status: "uploading",
      };
      if (!uploadingMap[key]) uploadingMap[key] = [];
      uploadingMap[key]!.push(task);
      validTasks.push(task);
    }

    await Promise.all(validTasks.map((task) => uploadSingleFile(key, task)));
    return validTasks;
  }

  /** 向单个 URL 尝试上传，返回图片地址，失败则抛出异常 */
  async function tryUploadToUrl(url: string, file: File): Promise<string> {
    const fd = new FormData();
    fd.append("file", file);

    const response = await fetch(url, { method: "POST", body: fd });

    if (!response.ok) {
      throw new Error(`上传失败: ${response.status}`);
    }

    const result = await response.json();
    const imageUrl = result.url || result.data?.url || result.imageUrl || result.data?.imageUrl;
    
    if (!imageUrl) {
      throw new Error("上传成功但未返回图片地址");
    }
    
    // 自动补全image 他可能是 返回的一个 /xxx/xxx 的路径 需要补全 location.origin
    const finalUrl = imageUrl.startsWith('/') ? `${location.origin}${imageUrl}` : imageUrl;
    return finalUrl;
  }

  /** 上传单个文件，依次尝试 effectiveUrls，全部失败后标记错误 */
  async function uploadSingleFile(key: string, task: UploadTask): Promise<void> {
    let lastError = "上传失败";

    for (const url of effectiveUrls) {
      try {
        const imageUrl = await tryUploadToUrl(url, task.file);

        const targetTask = uploadingMap[key]?.find((t) => t.id === task.id);
        if (targetTask) {
          targetTask.status = "success";
          targetTask.remoteUrl = imageUrl;
        }

        options.onSuccess?.(key, imageUrl, task);
        return;
      } catch (error) {
        lastError = (error as Error).message;
      }
    }

    const targetTask = uploadingMap[key]?.find((t) => t.id === task.id);
    if (targetTask) {
      targetTask.status = "error";
      targetTask.error = lastError;
    }
    options.onError?.(key, lastError, task);
  }

  /** 重试上传 */
  async function retryUpload(key: string, taskId: string): Promise<void> {
    const tasks = uploadingMap[key];
    if (!tasks) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    task.status = "uploading";
    task.error = undefined;
    await uploadSingleFile(key, task);
  }

  /** 移除上传任务 */
  function removeUploadTask(key: string, taskId: string): void {
    const tasks = uploadingMap[key];
    if (!tasks) return;
    const index = tasks.findIndex((t) => t.id === taskId);
    if (index > -1) {
      const task = tasks[index];
      if (task?.preview) URL.revokeObjectURL(task.preview);
      tasks.splice(index, 1);
    }
  }

  /** 清空某 key 下所有上传任务 */
  function clearTasks(key: string): void {
    const tasks = uploadingMap[key];
    if (!tasks) return;
    tasks.forEach((t) => {
      if (t.preview) URL.revokeObjectURL(t.preview);
    });
    delete uploadingMap[key];
  }

  return {
    uploadingMap,
    getTasks,
    uploadFiles,
    uploadSingleFile,
    retryUpload,
    removeUploadTask,
    clearTasks,
    validateFile,
  };
}
