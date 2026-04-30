<template>
  <div class="py-1">
    <div v-if="textResources.length" class="mb-2 space-y-2">
      <div v-for="(res, idx) in textResources" :key="'text-' + idx"
        class="rounded border border-slate-100 bg-slate-50 p-3 text-sm text-slate-700">
        {{ res.text }}
      </div>
    </div>
    <div v-if="imageResources.length" class="grid grid-cols-4 gap-0.5 overflow-hidden rounded"
      style="min-height: 120px">
      <div v-for="(res, idx) in imageResources" :key="'img-' + idx" class="relative overflow-hidden bg-gray-100">
        <LazyImage :src="res.url" :alt="prompt || '资源'" :preview-list="imageUrls" :preview-index="Number(idx)" class="h-auto w-full object-contain" />
      </div>
    </div>
    <div v-if="videoResources.length" class="mt-2 space-y-2 overflow-hidden rounded">
      <CustomVideoPlayer v-for="(res, idx) in videoResources" :key="'vid-' + idx" :src="res.url" />
    </div>
    <div v-if="audioResources.length" class="mt-2 space-y-2">
      <CustomAudioPlayer v-for="(res, idx) in audioResources" :key="'aud-' + idx" :src="res.url" />
    </div>
    <div v-if="fileResources.length" class="mt-2 flex flex-wrap gap-2">
      <a v-for="(res, idx) in fileResources" :key="'file-' + idx" :href="res.url" target="_blank"
        class="flex items-center gap-1 text-xs text-blue-500 underline-offset-2 hover:text-blue-700 hover:underline">
        <i class="fa-solid fa-file-arrow-down"></i>
        <span>下载文件 {{ Number(idx) + 1 }}</span>
      </a>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import LazyImage from "@/components/LazyImage.vue";
import CustomVideoPlayer from "../CustomVideoPlayer.vue";
import CustomAudioPlayer from "../CustomAudioPlayer.vue";

const props = defineProps<{
  textResources: any[];
  imageResources: any[];
  videoResources: any[];
  audioResources: any[];
  fileResources: any[];
  prompt: string;
}>();

const imageUrls = computed(() => props.imageResources.map((r: any) => r.url));
</script>
