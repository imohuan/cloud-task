import { h, render } from "vue";
import ImageViewer from "@/components/ImageViewer.vue";

let container: HTMLDivElement | null = null;

export function useImageViewer() {
  const open = (images: string[], initialIndex = 0) => {
    const imageList = Array.isArray(images) ? images : [images].filter(Boolean);

    if (imageList.length === 0) {
      console.warn("没有可预览的图片");
      return;
    }

    close();

    container = document.createElement("div");
    document.body.appendChild(container);

    const vnode = h(ImageViewer, {
      images: imageList,
      initialIndex,
      visible: true,
      "onUpdate:visible": (val: boolean) => {
        if (!val) {
          close();
        }
      },
      onClose: () => {
        close();
      },
    });

    render(vnode, container);

    document.body.style.overflow = "hidden";
  };

  const close = () => {
    if (container) {
      render(null, container);
      container.remove();
      container = null;
    }
    document.body.style.overflow = "";
  };

  return {
    open,
    close,
  };
}

let globalViewer: ReturnType<typeof useImageViewer> | null = null;

export function createImageViewer() {
  if (!globalViewer) {
    globalViewer = useImageViewer();
  }
  return globalViewer;
}

export function previewImages(images: string[], initialIndex = 0) {
  const viewer = createImageViewer();
  viewer.open(images, initialIndex);
}
