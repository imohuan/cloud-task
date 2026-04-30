<template>
  <div class="flex items-end gap-5">
    <div v-if="referenceImages.length" class="relative shrink-0"
      :style="{ width: getStackedWidth(referenceImages.length), height: '56px', paddingTop: '4px' }">
      <div class="left-0 flex">
        <div v-for="(img, index) in referenceImages.slice(0, 3)" :key="index"
          class="relative h-12 w-9 shrink-0 rounded border border-slate-200 bg-white shadow-sm transition-transform hover:z-10 hover:scale-105"
          :style="{
            marginLeft: Number(index) > 0 ? '-5px' : '0',
            transform: 'rotate(' + getRotation(Number(index)) + 'deg)',
            zIndex: referenceImages.length - Number(index),
          }">
          <LazyImage :src="img" object-fit="cover" class="rounded-[3px]" :preview-list="referenceImages" :preview-index="Number(index)" />
          <div v-if="index === 0"
            class="absolute -bottom-1 -left-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-white shadow">
            <i class="fa-solid fa-quote-left text-[7px] text-slate-400"></i>
          </div>
        </div>
      </div>
    </div>
    <div class="group/prompt relative min-w-0 flex-1">
      <div class="h-5 truncate text-sm leading-5 text-slate-800">
        <span class="select-text">{{ prompt }}</span>
      </div>
      <div
        class="absolute top-0 right-0 left-0 -mt-[1px] z-10 max-h-0 overflow-hidden pb-1 leading-5 opacity-0 group-hover/prompt:max-h-[300px] group-hover/prompt:rounded group-hover/prompt:bg-white/95 group-hover/prompt:opacity-100 group-hover/prompt:shadow-sm"
        style="box-shadow: inset 0 0 0 1px #e2e8f0">
        <span class="text-sm break-all text-slate-800 select-text">{{ prompt }}</span>
        <button @click.stop="emit('use-prompt', prompt)"
          class="ml-2 inline-flex items-center gap-1 rounded bg-slate-100 px-2 text-xs whitespace-nowrap text-slate-600 hover:bg-slate-200 hover:text-slate-800"
          title="使用这个提示词">
          <i class="fa-solid fa-pen-to-square text-[10px]"></i>使用
        </button>
      </div>
      <div class="mt-1 flex flex-wrap items-center gap-2 font-mono text-xs text-slate-500">
        <span class="rounded bg-slate-100 px-1.5 py-0.5">
          <i :class="resourceTypeIcon" class="mr-1"></i>
          {{ apiName }}
        </span>
        <span class="inline-block h-2.5 w-px bg-slate-300"></span>
        <span v-if="displayModel">{{ displayModel }}</span>
        <span v-if="resolution" class="inline-block h-2.5 w-px bg-slate-300"></span>
        <span v-if="resolution">{{ resolution }}</span>
        <template v-if="elapsed">
          <span class="inline-block h-2.5 w-px bg-slate-300"></span>
          <span class="underline">{{ elapsed }}</span>
        </template>
        <template v-if="completedAt">
          <span class="inline-block h-2.5 w-px bg-slate-300"></span>
          <span class="text-slate-400">{{ completedAt }}</span>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import LazyImage from "@/components/LazyImage.vue";

const props = defineProps<{
  referenceImages: string[];
  prompt: string;
  apiName: string;
  resourceType: string;
  displayModel: string;
  resolution?: string;
  elapsed?: string;
  completedAt?: string;
}>();

const emit = defineEmits<{
  (e: "use-prompt", prompt: string): void;
}>();

const resourceTypeIcon = computed(() => {
  if (props.resourceType === "video") return "fa-solid fa-video";
  if (props.resourceType === "audio") return "fa-solid fa-headphones";
  return "fa-solid fa-image";
});

function getRotation(index: number) {
  const rotations = [-8, 5, -8];
  return rotations[index] || 0;
}

function getStackedWidth(count: number) {
  const w = 36, overlap = 12, max = Math.min(count, 3);
  if (max === 1) return w + "px";
  return w + (max - 1) * (w - overlap) + "px";
}
</script>
