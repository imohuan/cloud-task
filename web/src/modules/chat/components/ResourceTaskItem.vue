<template>
  <div class="space-y-1">
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
            <img :src="img" class="h-full w-full rounded-[3px] object-cover" />
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
          class="absolute top-0 right-0 left-0 z-10 max-h-0 overflow-hidden pb-1 leading-5 opacity-0 group-hover/prompt:max-h-[300px] group-hover/prompt:rounded group-hover/prompt:bg-white/95 group-hover/prompt:opacity-100 group-hover/prompt:shadow-sm"
          style="box-shadow: inset 0 0 0 1px #e2e8f0">
          <span class="text-sm break-all text-slate-800 select-text">{{ prompt }}</span>
          <button @click.stop="onUsePrompt"
            class="ml-2 inline-flex items-center gap-1 rounded bg-slate-100 px-2 text-xs whitespace-nowrap text-slate-600 hover:bg-slate-200 hover:text-slate-800"
            title="使用这个提示词">
            <i class="fa-solid fa-pen-to-square text-[10px]"></i>使用
          </button>
        </div>
        <div class="mt-1 flex flex-wrap items-center gap-2 font-mono text-xs text-slate-500">
          <span class="rounded bg-slate-100 px-1.5 py-0.5">
            <i :class="getResourceTypeIcon(resourceType)" class="mr-1"></i>
            {{ apiName }}
          </span>
          <span class="inline-block h-2.5 w-px bg-slate-300"></span>
          <span v-if="displayModel">{{ displayModel }}</span>
          <span v-if="input.resolution" class="inline-block h-2.5 w-px bg-slate-300"></span>
          <span v-if="input.resolution">{{ input.resolution }}</span>
          <template v-if="task.elapsed">
            <span class="inline-block h-2.5 w-px bg-slate-300"></span>
            <span class="underline">{{ task.elapsed }}</span>
          </template>
          <template v-if="completedAt">
            <span class="inline-block h-2.5 w-px bg-slate-300"></span>
            <span class="text-slate-400">{{ completedAt }}</span>
          </template>
        </div>
      </div>
    </div>

    <!-- 内容部分 -->
    <div class="relative" :class="imageResources.length ? 'max-w-[800px]' : 'max-w-[500px]'">
      <template v-if="displayStatus === 'error'">
        <div class="rounded border border-red-200 bg-red-50 p-4">
          <div class="flex items-center gap-3">
            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100">
              <i class="fa-solid fa-circle-exclamation text-red-500"></i>
            </div>
            <div class="min-w-0">
              <div class="text-sm font-medium text-red-700">生成失败</div>
              <div v-if="task.error" class="mt-0.5 text-xs break-words text-red-500">{{ task.error }}</div>
            </div>
          </div>
        </div>
      </template>

      <template v-else-if="displayStatus === 'success' && !hasMediaResources && !textResources.length">
        <div class="rounded border border-yellow-200 bg-yellow-50 p-4">
          <div class="flex items-center gap-3">
            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-yellow-100">
              <i class="fa-solid fa-triangle-exclamation text-yellow-500"></i>
            </div>
            <div>
              <div class="text-sm font-medium text-yellow-700">未生成资源</div>
              <div class="mt-0.5 text-xs text-yellow-500">任务已完成但未返回资源</div>
            </div>
          </div>
        </div>
      </template>

      <template v-else-if="displayStatus === 'pending'">
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

      <template v-else-if="displayStatus === 'processing'">
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
                <h3 class="text-base font-medium text-white">{{ getCategoryLabel() }}</h3>
                <p class="text-[11px] text-white/60">{{ getCategorySubtext() }}</p>
              </div>
              <div class="text-right">
                <span class="text-3xl leading-none font-light text-white italic tabular-nums">{{ task.progress || 0
                  }}<span class="text-sm">%</span></span>
              </div>
            </div>
            <div class="absolute bottom-0 left-0 h-1 bg-indigo-600/50 transition-all duration-500"
              :style="{ width: (task.progress || 0) + '%' }" style="box-shadow: 0 0 15px rgba(99, 102, 241, 0.8)"></div>
          </div>
        </div>
      </template>

      <template v-else-if="displayStatus === 'success'">
        <div v-if="textResources.length" class="mb-2 space-y-2">
          <div v-for="(res, idx) in textResources" :key="'text-' + idx"
            class="rounded border border-slate-100 bg-slate-50 p-3 text-sm text-slate-700">
            {{ res.text }}
          </div>
        </div>
        <div v-if="imageResources.length" class="grid grid-cols-4 gap-0.5 overflow-hidden rounded"
          style="min-height: 120px">
          <div v-for="(res, idx) in imageResources" :key="'img-' + idx" class="relative overflow-hidden bg-gray-100">
            <LazyImage :src="res.url" :alt="prompt || '资源'" class="h-auto w-full object-contain" />
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
            class="flex items-center gap-1.5 rounded bg-slate-100 px-3 py-1.5 text-xs text-slate-700 transition-colors hover:bg-slate-200">
            <i class="fa-solid fa-file-arrow-down text-[10px]"></i>
            <span>下载文件 {{ Number(idx) + 1 }}</span>
          </a>
        </div>
      </template>

      <template v-else>
        <div class="grid grid-cols-4 gap-0.5 overflow-hidden rounded" style="height: 175px">
          <div v-for="i in 4" :key="i" class="bg-slate-100"></div>
        </div>
      </template>
    </div>

    <div class="flex items-center gap-1.5" v-if="displayStatus === 'success' || displayStatus === 'error'">
      <button @click="onRegenerate"
        class="flex h-7 items-center gap-1.5 rounded bg-slate-100 px-3 text-xs font-medium text-slate-700 transition-all hover:bg-slate-200 active:scale-95">
        <i class="fa-solid fa-rotate-right text-[10px]"></i>重新生成
      </button>
      <button @click="onReferenceImages"
        class="flex h-7 items-center gap-1.5 rounded bg-slate-100 px-3 text-xs font-medium text-slate-700 transition-all hover:bg-slate-200 active:scale-95">
        <i class="fa-regular fa-comment text-[10px]"></i>重做
      </button>
      <button @click="onDelete"
        class="flex h-7 items-center gap-1.5 rounded bg-slate-100 px-3 text-xs font-medium text-slate-700 transition-all hover:bg-red-50 hover:text-red-500 active:scale-95">
        <i class="fa-regular fa-trash-can text-[10px]"></i>删除
      </button>
    </div>
    <ConfirmDialog v-model="deleteDialogVisible" title="删除任务" content="确定要删除该任务吗？此操作不可恢复。" type="danger"
      confirm-text="删除" @confirm="handleDeleteConfirm" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useRegistryStore } from "@/stores/useRegistryStore";
import LazyImage from "@/components/LazyImage.vue";
import CustomVideoPlayer from "./CustomVideoPlayer.vue";
import CustomAudioPlayer from "./CustomAudioPlayer.vue";
import ConfirmDialog from "@/components/ConfirmDialog.vue";

const props = defineProps<{
  task: any;
}>();

const emit = defineEmits<{
  (e: "use-prompt", prompt: string): void;
  (e: "regenerate", task: any): void;
  (e: "delete", taskId: string): void;
  (e: "quote-task", task: any): void;
}>();

const registryStore = useRegistryStore();
const deleteDialogVisible = ref(false);

const apiInfo = computed(() => registryStore.getApiById(props.task.apiId));
const categoryInfo = computed(() => {
  const api = apiInfo.value;
  if (!api?.categoryId) return null;
  return registryStore.categories.find((c: any) => c.id === api.categoryId);
});

const resourceType = computed(() => categoryInfo.value?.id || "image");
const apiName = computed(() => apiInfo.value?.name || registryStore.getApiNameById(props.task.apiId) || "未知 API");

const input = computed(() => props.task.input || {});
const prompt = computed(() => (input.value as any).prompt || "");
const displayModel = computed(() => {
  const m = (input.value as any).model;
  if (!m) return "";
  const id = typeof m === "object" ? m?.id || "" : String(m);
  const api = apiInfo.value as any;
  const modelField = api?.inputSchema?.fields?.find((f: any) => f.name === "model");
  const match = modelField?.enumValues?.find((ev: any) => ev.value === id);
  return match?.label || id;
});
const referenceImages = computed(() => [...(input.value?.referenceImages || []), ...(input.value?.image || [])]);
const outputContent = computed(() => props.task.output?.content || []);

const displayStatus = computed(() => {
  const s = props.task.status;
  if (s === "completed") return "success";
  if (s === "running" || s === "polling" || s === "polling-run") return "processing";
  if (s === "failed") return "error";
  return "pending";
});

const imageResources = computed(() => outputContent.value.filter((c: any) => c.type === "image" && c.url));
const videoResources = computed(() => outputContent.value.filter((c: any) => c.type === "video" && c.url));
const audioResources = computed(() => outputContent.value.filter((c: any) => c.type === "audio" && c.url));
const textResources = computed(() => outputContent.value.filter((c: any) => c.type === "text" && c.text));
const fileResources = computed(() => outputContent.value.filter((c: any) => c.type === "file" && c.url));

const hasMediaResources = computed(
  () =>
    imageResources.value.length > 0 ||
    videoResources.value.length > 0 ||
    audioResources.value.length > 0 ||
    fileResources.value.length > 0,
);

function onUsePrompt() {
  emit("use-prompt", prompt.value);
}

function onReferenceImages() {
  emit("quote-task", props.task);
}

function onRegenerate() {
  emit("regenerate", props.task);
}

function onDelete() {
  deleteDialogVisible.value = true;
}

function handleDeleteConfirm() {
  deleteDialogVisible.value = false;
  emit("delete", props.task.taskId);
}

function getRotation(index: number) {
  const rotations = [-8, 5, -8];
  return rotations[index] || 0;
}

function getStackedWidth(count: number) {
  const w = 36,
    overlap = 12,
    max = Math.min(count, 3);
  if (max === 1) return w + "px";
  return w + (max - 1) * (w - overlap) + "px";
}

function getResourceTypeIcon(type: string) {
  if (type === "video") return "fa-solid fa-video";
  if (type === "audio") return "fa-solid fa-headphones";
  return "fa-solid fa-image";
}

function getCategoryLabel() {
  const type = resourceType.value;
  if (type === "video") return "AI 视频生成";
  if (type === "audio") return "AI 音频生成";
  return "AI 图片生成";
}

function getCategorySubtext() {
  const type = resourceType.value;
  if (type === "video") return "正在渲染光影特效...";
  if (type === "audio") return "正在合成声波韵律...";
  return "正在构思画面...";
}

function formatTime(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const completedAt = computed(() => formatTime(props.task.completedAt));
</script>
