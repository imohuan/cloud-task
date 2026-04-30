<template>
  <div class="relative overflow-hidden rounded bg-slate-900" style="height: 175px">
    <div class="absolute inset-0 overflow-hidden">
      <video autoplay muted loop playsinline class="h-full w-full object-cover mix-blend-screen"
        src="https://lf3-lv-buz.vlabstatic.com/obj/image-lvweb-buz/ies/lvweb/dreamina_cn/static/media/record-loading-animation.b017f24d.mp4"></video>
    </div>

    <template v-if="resourceType === 'image'">
      <div class="absolute inset-0 flex">
        <div class="flex-1 border-r border-white/10" v-for="n in 4" :key="n"></div>
      </div>
    </template>
    <div
      class="absolute top-2 left-2 z-10 flex items-center gap-1 rounded-md bg-white/40 px-2 py-0.5 shadow-sm backdrop-blur-md">
      <i class="fa-regular fa-clock text-[10px] text-gray-900"></i>
      <span class="text-[11px] font-bold text-gray-900">排队中...</span>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  resourceType: string;
}>();
</script>
