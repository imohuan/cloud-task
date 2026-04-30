<template>
  <div class="relative overflow-hidden rounded bg-slate-900" style="height: 175px">
    <div class="absolute inset-0 overflow-hidden">
      <video autoplay muted loop playsinline class="h-full w-full object-cover mix-blend-screen"
        src="https://lf3-lv-buz.vlabstatic.com/obj/image-lvweb-buz/ies/lvweb/dreamina_cn/static/media/record-loading-animation.b017f24d.mp4"></video>
    </div>
    <template v-if="resourceType === 'audio'">
      <div class="pointer-events-none absolute inset-0 flex items-center justify-center gap-[2px]">
        <div v-for="i in 28" :key="i" class="wave-bar w-[3px] rounded-full"
          :class="i % 3 === 0 ? 'bg-white/90' : i % 3 === 1 ? 'bg-white/75' : 'bg-white/60'" :style="{
            '--wave-h': 12 + Math.abs(Math.sin(i * 0.7)) * 48 + 'px',
            '--wave-dur': 0.4 + Math.abs(Math.cos(i * 0.5)) * 0.6 + 's',
            '--wave-delay': i * 0.03 + 's',
            height: '3px',
          }"></div>
      </div>
    </template>
    <div
      class="animate-scan pointer-events-none absolute inset-x-0 h-1/2 bg-gradient-to-b from-transparent via-indigo-500/20 to-transparent">
    </div>
    <div class="relative flex h-full items-end bg-gradient-to-t from-black/60 to-transparent p-6">
      <div class="flex w-full items-end justify-between">
        <div>
          <h3 class="text-base font-medium text-white">{{ categoryLabel }}</h3>
          <p class="text-[11px] text-white/60">{{ categorySubtext }}</p>
        </div>
        <div class="text-right">
          <span class="text-3xl leading-none font-light text-white italic tabular-nums">{{ progress }}<span class="text-sm">%</span></span>
        </div>
      </div>
      <div class="absolute bottom-0 left-0 h-1 bg-indigo-600/50 transition-all duration-500"
        :style="{ width: progress + '%' }" style="box-shadow: 0 0 15px rgba(99, 102, 241, 0.8)"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  resourceType: string;
  progress: number;
}>();

const categoryLabel = computed(() => {
  if (props.resourceType === "video") return "AI 视频生成";
  if (props.resourceType === "audio") return "AI 音频生成";
  return "AI 图片生成";
});

const categorySubtext = computed(() => {
  if (props.resourceType === "video") return "正在渲染光影特效...";
  if (props.resourceType === "audio") return "正在合成声波韵律...";
  return "正在构思画面...";
});
</script>

<style scoped>
.wave-bar {
  animation: wave var(--wave-dur, 0.6s) ease-in-out var(--wave-delay, 0s) infinite alternate;
}

@keyframes wave {
  0% {
    height: 3px;
  }
  100% {
    height: var(--wave-h, 20px);
  }
}
</style>
