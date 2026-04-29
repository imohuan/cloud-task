import { useImageUpload } from "@/composables/useImageUpload";

export function usePasteImage({
  onImagePaste,
  onImageUploaded,
}: {
  onImagePaste?: (url: string, uploadId: string | null) => void;
  /** 上传成功回调，用于将本地预览 URL 替换为远程 URL */
  onImageUploaded?: (localUrl: string, remoteUrl: string) => void;
} = {}) {
  const { uploadFiles } = useImageUpload({
    onSuccess(key, remoteUrl) {
      onImageUploaded?.(key, remoteUrl);
    },
  });

  async function handlePaste(event: ClipboardEvent) {
    const items = event.clipboardData?.items;
    if (!items) return;

    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item) continue;
      if (item.type.indexOf("image") !== -1) {
        event.preventDefault();
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
        break;
      }
    }

    if (imageFiles.length > 0) {
      // 先用本地预览立即展示
      const localUrls: string[] = [];
      for (const file of imageFiles) {
        const previewUrl = URL.createObjectURL(file);
        localUrls.push(previewUrl);
        onImagePaste?.(previewUrl, null);
      }
      // 异步上传，key 用 localUrl 做关联
      for (let i = 0; i < imageFiles.length; i++) {
        const localUrl = localUrls[i];
        const file = imageFiles[i];
        if (localUrl && file) {
          uploadFiles(localUrl, [file]).catch(() => {});
        }
      }
    }
  }

  return { handlePaste };
}
