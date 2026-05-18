<template>
  <div class="py-1">
    <div v-if="textResources.length" class="space-y-2">
      <div v-for="(res, idx) in textResources" :key="'text-' + idx"
        class="rounded border border-slate-100 bg-slate-50 p-3 text-sm text-slate-700">
        {{ res.text }}
      </div>
    </div>
    <div v-if="imageResources.length" :class="['grid gap-0.5 overflow-hidden rounded', appStore.isMobile ? 'grid-cols-2' : 'grid-cols-4']"
      :style="`min-height: ${appStore.isMobile ? '50px' : '70px'}`">
      <div
        v-for="(res, idx) in imageResources"
        :key="'img-' + idx"
        class="relative w-full overflow-hidden bg-gray-100"
      >
        <LazyImage
          :src="res.url"
          :alt="prompt || '资源'"
          :preview-list="imageUrls"
          :preview-index="Number(idx)"
          object-fit="contain"
          :adaptive-aspect="true"
          class="h-full w-full"
        />
      </div>
    </div>
    <div v-if="videoResources.length" class="space-y-2 overflow-hidden rounded">
      <CustomVideoPlayer v-for="(res, idx) in videoResources" :key="'vid-' + idx" :src="res.url" />
    </div>
    <div v-if="audioResources.length" class="space-y-2">
      <CustomAudioPlayer v-for="(res, idx) in audioResources" :key="'aud-' + idx" :src="res.url" />
    </div>
    <div v-if="fileResources.length" class="space-y-2">
      <a v-for="(res, idx) in fileResources" :key="'file-' + idx" :href="res.url" target="_blank"
        class="flex items-center gap-3 rounded border border-slate-200 bg-slate-50 px-3 py-2.5 transition-colors hover:bg-slate-100">
        <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-slate-200 text-slate-500">
          <i class="fa-solid fa-file-arrow-down text-sm"></i>
        </span>
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium text-slate-700">下载文件 {{ Number(idx) + 1 }}</p>
          <p class="text-xs text-slate-400">点击下载</p>
        </div>
      </a>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import LazyImage from "@/components/LazyImage.vue";
import CustomVideoPlayer from "../CustomVideoPlayer.vue";
import CustomAudioPlayer from "../CustomAudioPlayer.vue";
import { useAppStore } from "@/stores/useAppStore"

const props = defineProps<{
  textResources: any[];
  imageResources: any[];
  videoResources: any[];
  audioResources: any[];
  fileResources: any[];
  prompt: string;
}>();

const appStore = useAppStore()
const imageUrls = computed(() => props.imageResources.map((r: any) => r.url));
</script>
