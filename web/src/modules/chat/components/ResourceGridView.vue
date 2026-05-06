<template>
  <div class="h-full overflow-y-auto">
    <div v-if="!items.length" class="flex flex-col items-center justify-center py-20 text-slate-400">
      <i class="fa-regular fa-images mb-3 text-4xl opacity-30"></i>
      <p class="text-sm">暂无内容</p>
    </div>
    <div v-else class="columns-2 gap-2 p-4 sm:columns-3 lg:columns-4 xl:columns-5">
      <div v-for="(item, idx) in items" :key="idx" class="mb-2 break-inside-avoid">
        <div
          v-if="item.type === 'image'"
          class="group relative overflow-hidden rounded-lg bg-slate-100"
        >
          <LazyImage
            :src="item.url"
            :alt="item.prompt || ''"
            :preview-list="imageUrls"
            :preview-index="item.imgIdx"
            class="block h-auto w-full"
          />
          <div
            v-if="item.prompt"
            class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100"
          >
            <p class="line-clamp-2 text-xs text-white">{{ item.prompt }}</p>
          </div>
        </div>
        <div v-else-if="item.type === 'video'" class="overflow-hidden rounded-lg bg-slate-100">
          <CustomVideoPlayer :src="item.url" mode="grid" />
        </div>
        <div v-else-if="item.type === 'audio'" class="rounded-lg border border-slate-200 bg-white p-2">
          <CustomAudioPlayer :src="item.url" />
        </div>
        <div v-else-if="item.type === 'text'" class="rounded-lg border border-slate-200 bg-white p-3">
          <p v-if="item.prompt" class="mb-1 line-clamp-1 text-xs text-slate-400">{{ item.prompt }}</p>
          <p class="text-sm text-slate-700">{{ item.text }}</p>
        </div>
        <a
          v-else-if="item.type === 'file'"
          :href="item.url"
          target="_blank"
          class="flex items-center gap-2 rounded-lg border border-slate-200 bg-white p-3 text-xs text-blue-600 transition-colors hover:bg-slate-50"
        >
          <i class="fa-solid fa-file-arrow-down shrink-0"></i>
          <span class="truncate">下载文件</span>
        </a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import LazyImage from "@/components/LazyImage.vue";
import CustomVideoPlayer from "./CustomVideoPlayer.vue";
import CustomAudioPlayer from "./CustomAudioPlayer.vue";
import { getImageUrl } from "@/config";

const props = defineProps<{
  tasks: any[];
}>();

const items = computed(() => {
  const result: any[] = [];
  let imgIdx = 0;
  for (const task of props.tasks) {
    if (task.status === "failed") continue;
    const content: any[] = task.output?.content || [];
    const prompt: string = task.input?.prompt || "";
    for (const c of content) {
      if (c.type === "image" && c.url) {
        result.push({ ...c, url: getImageUrl(c.url), prompt, imgIdx: imgIdx++ });
      } else if (c.type === "video" && c.url) {
        result.push({ ...c, url: getImageUrl(c.url), prompt });
      } else if (c.type === "audio" && c.url) {
        result.push({ ...c, url: getImageUrl(c.url), prompt });
      } else if (c.type === "text" && c.text) {
        result.push({ ...c, prompt });
      } else if (c.type === "file" && c.url) {
        result.push({ ...c, url: getImageUrl(c.url), prompt });
      }
    }
  }
  return result;
});

const imageUrls = computed(() =>
  items.value.filter((i) => i.type === "image").map((i) => i.url),
);
</script>
