<template>
  <div
    ref="containerRef"
    class="group relative aspect-video overflow-hidden rounded bg-black"
    :class="isFullscreen ? 'fixed inset-0 z-[9999]' : ''"
    @mouseenter="
      clearHideTimer();
      controlsVisible = true;
    "
    @mouseleave="startHideTimer"
    @touchstart.passive="onTouchShowControls"
  >
    <video
      ref="videoRef"
      class="w-full cursor-pointer"
      :class="isFullscreen ? 'h-screen object-contain' : 'aspect-video'"
      @click="togglePlay"
      @timeupdate="onTimeUpdate"
      @loadedmetadata="onLoadedMetadata"
      @ended="onEnded"
      @waiting="isBuffering = true"
      @playing="isBuffering = false"
      @progress="onTimeUpdate"
      @loadeddata="captureFirstFrame"
      :poster="poster || generatedPoster"
      preload="metadata"
      :loop="loopEnabled"
      playsinline
    >
      <source :src="src" type="video/mp4" />
    </video>
    <Transition name="scale-fade">
      <div
        v-if="showCenterIcon"
        class="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm"
        :class="mode === 'grid' && !isFullscreen ? 'h-9 w-9 text-base' : 'h-16 w-16 text-2xl'"
      >
        <i :class="isPlaying ? 'fas fa-pause' : 'fas fa-play'" class="ml-0.5"></i>
      </div>
    </Transition>
    <div v-if="isBuffering" class="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[2px]">
      <i class="fas fa-circle-notch fa-spin text-3xl text-white"></i>
    </div>
    <div
      v-if="!hasStarted"
      class="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/30 transition-all group-hover:bg-black/10"
      @click="togglePlay"
    >
      <div
        class="flex items-center justify-center rounded-full bg-white/20 text-white shadow-xl backdrop-blur-sm transition-all hover:bg-white/30"
        :class="mode === 'grid' && !isFullscreen ? 'h-10 w-10' : 'h-14 w-14'"
      >
        <i class="fas fa-play ml-0.5" :class="mode === 'grid' && !isFullscreen ? 'text-sm' : 'text-lg'"></i>
      </div>
    </div>
    <button
      v-if="mode === 'grid' && !isFullscreen"
      class="absolute bottom-1.5 right-1.5 z-10 flex h-5 w-5 items-center justify-center rounded bg-black/50 text-white backdrop-blur-sm transition-colors hover:bg-black/70"
      @click.stop="toggleFullscreen"
      title="全屏"
    >
      <i class="fas fa-expand text-[9px]"></i>
    </button>
    <Transition name="fade-move">
      <div v-show="controlsVisible && (mode !== 'grid' || isFullscreen)" class="controls-gradient absolute right-0 bottom-0 left-0 p-3">
        <div class="group/progress relative mb-2 flex h-5 items-center">
          <div class="absolute h-1 w-full overflow-hidden rounded-full bg-white/20">
            <div class="absolute h-full bg-white/30" :style="{ width: bufferPercent + '%' }"></div>
            <div class="absolute h-full bg-blue-500" :style="{ width: progressPercent + '%' }"></div>
          </div>
          <input
            type="range"
            min="0"
            :max="duration"
            step="0.1"
            v-model="currentTime"
            @input="onSeek"
            @mousedown="seeking = true"
            @mouseup="seeking = false"
            class="range-video absolute z-10 h-1 w-full cursor-pointer opacity-0"
          />
        </div>
        <div class="flex items-center justify-between text-white">
          <div class="flex items-center gap-3">
            <button
              @click="togglePlay"
              class="flex h-7 w-7 items-center justify-center rounded transition-colors hover:bg-white/10"
            >
              <i :class="isPlaying ? 'fas fa-pause' : 'fas fa-play'" class="text-sm"></i>
            </button>
            <div class="group/volume flex items-center gap-1.5">
              <button @click="toggleMute" class="flex h-7 w-7 items-center justify-center">
                <i :class="volumeIcon" class="text-sm"></i>
              </button>
              <div class="flex w-0 items-center overflow-hidden transition-all duration-300 group-hover/volume:w-16">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  v-model="volume"
                  class="range-audio-volume h-1 w-14 cursor-pointer appearance-none rounded-full bg-white/30"
                />
              </div>
            </div>
            <div class="font-mono text-[10px] font-medium tracking-wider">
              <span>{{ formatTime(currentTime) }}</span>
              <span class="mx-1 opacity-50">/</span>
              <span class="opacity-70">{{ formatTime(duration) }}</span>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <div class="relative" ref="speedDropdownRef">
              <button
                @click="speedDropdownOpen = !speedDropdownOpen"
                class="rounded border border-white/20 px-1.5 py-0.5 text-[9px] font-bold transition-colors hover:bg-white/10"
              >
                {{ playbackRate }}x
              </button>
              <Transition name="fade-move">
                <div
                  v-if="speedDropdownOpen"
                  class="absolute right-0 bottom-full z-20 mb-2 min-w-[70px] overflow-hidden rounded-lg border border-gray-100 bg-white py-1 text-gray-800 shadow-xl"
                >
                  <div
                    v-for="rate in rates"
                    :key="rate"
                    @click="setPlaybackRate(rate)"
                    :class="playbackRate === rate ? 'bg-blue-50 font-bold text-blue-600' : 'hover:bg-gray-50'"
                    class="flex cursor-pointer items-center justify-between px-3 py-1.5 text-xs transition-colors"
                  >
                    {{ rate }}x
                    <i v-if="playbackRate === rate" class="fas fa-check text-[8px]"></i>
                  </div>
                </div>
              </Transition>
            </div>
            <button
              @click="toggleLoop"
              class="flex h-7 w-7 items-center justify-center rounded transition-colors hover:bg-white/10"
              :class="loopEnabled ? 'text-blue-400' : 'text-white'"
              title="循环播放"
            >
              <i class="fas fa-repeat text-[10px]"></i>
            </button>
            <button
              @click="togglePip"
              class="flex h-7 w-7 items-center justify-center rounded transition-colors hover:bg-white/10"
              title="画中画"
            >
              <i class="fas fa-clone text-[10px]"></i>
            </button>
            <button
              v-if="isFullscreen"
              @click="toggleOrientation"
              class="flex h-7 w-7 items-center justify-center rounded transition-colors hover:bg-white/10"
              :title="isLandscape ? '切换竖屏' : '切换横屏'"
            >
              <i class="fas fa-rotate text-[10px]" :class="isLandscape ? 'rotate-90' : ''"></i>
            </button>
            <button
              @click="toggleFullscreen"
              class="flex h-7 w-7 items-center justify-center rounded transition-colors hover:bg-white/10"
            >
              <i :class="isFullscreen ? 'fas fa-compress' : 'fas fa-expand'" class="text-[10px]"></i>
            </button>
          </div>
        </div>
      </div>
    </Transition>
    <div class="fixed bottom-4 left-1/2 z-[100] -translate-x-1/2">
      <TransitionGroup>
        <div
          v-for="toast in toasts"
          :key="toast.id"
          class="mb-1 flex items-center gap-2 rounded-full bg-gray-900 px-3 py-1.5 text-[11px] text-white shadow-lg"
        >
          <i class="fas fa-info-circle text-[10px] text-blue-400"></i>
          <span>{{ toast.message }}</span>
        </div>
      </TransitionGroup>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { useMediaPlayer } from "../composables/useMediaPlayer";
import { useToast } from "../composables/useToast";

const props = defineProps<{
  src: string;
  poster?: string;
  mode?: 'list' | 'grid';
}>();

const videoRef = ref<HTMLVideoElement | null>(null);
const containerRef = ref<HTMLElement | null>(null);
const hasStarted = ref(false);
const isFullscreen = ref(false);
const isLandscape = ref(false);
const isBuffering = ref(false);
const controlsVisible = ref(false);
const showCenterIcon = ref(false);
const speedDropdownOpen = ref(false);
const speedDropdownRef = ref<HTMLElement | null>(null);
const bufferPercent = ref(0);
const loopEnabled = ref(props.mode === 'grid');
let controlsTimer: ReturnType<typeof setTimeout> | null = null;

const {
  isPlaying,
  currentTime,
  duration,
  volume,
  playbackRate,
  seeking,
  rates,
  progressPercent,
  volumeIcon,
  formatTime,
  togglePlay: baseTogglePlay,
  onTimeUpdate: baseOnTimeUpdate,
  onLoadedMetadata,
  onEnded,
  setPlaybackRate: baseSetPlaybackRate,
  toggleMute,
} = useMediaPlayer(videoRef, { initialVolume: 0.7, resetOnEnded: false });

const generatedPoster = ref<string>("");

const { toasts, showToast } = useToast();

function captureFirstFrame() {
  if (props.poster || !videoRef.value) return;
  const video = videoRef.value;
  if (!video.videoWidth || !video.videoHeight) return;

  const onSeeked = () => {
    video.removeEventListener("seeked", onSeeked);
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      generatedPoster.value = canvas.toDataURL("image/jpeg", 0.8);
    }
    video.currentTime = 0;
  };

  video.addEventListener("seeked", onSeeked);
  video.currentTime = 0.1;
}

function togglePlay() {
  if (!hasStarted.value) hasStarted.value = true;
  baseTogglePlay();
  triggerCenterFeedback();
}

function triggerCenterFeedback() {
  showCenterIcon.value = true;
  setTimeout(() => (showCenterIcon.value = false), 500);
}

function onTimeUpdate() {
  baseOnTimeUpdate();
  if (videoRef.value && videoRef.value.buffered.length > 0 && duration.value) {
    const bufferedEnd = videoRef.value.buffered.end(videoRef.value.buffered.length - 1);
    bufferPercent.value = (bufferedEnd / duration.value) * 100;
  }
}

function onSeek() {
  if (videoRef.value) videoRef.value.currentTime = currentTime.value;
}

function setPlaybackRate(rate: number) {
  baseSetPlaybackRate(rate);
  speedDropdownOpen.value = false;
  showToast(`播放速度: ${rate}x`);
}

async function toggleFullscreen() {
  const container = containerRef.value;
  if (!container) return;
  if (!isFullscreen.value) {
    try { await container.requestFullscreen(); } catch (_) {}
    isFullscreen.value = true;
    controlsVisible.value = true;
    try { await (screen.orientation as any).lock('landscape'); } catch (_) {}
  } else {
    try { if (document.fullscreenElement) await document.exitFullscreen(); } catch (_) {}
    isFullscreen.value = false;
    try { screen.orientation.unlock(); } catch (_) {}
  }
}

function toggleLoop() {
  loopEnabled.value = !loopEnabled.value;
}

async function togglePip() {
  try {
    if (videoRef.value !== document.pictureInPictureElement) {
      await videoRef.value?.requestPictureInPicture();
    } else {
      await document.exitPictureInPicture();
    }
  } catch (error) {
    showToast("浏览器不支持画中画");
  }
}

function clearHideTimer() {
  if (controlsTimer) {
    clearTimeout(controlsTimer);
    controlsTimer = null;
  }
}

function startHideTimer() {
  controlsTimer = setTimeout(() => {
    controlsVisible.value = false;
    controlsTimer = null;
  }, 1000);
}

function onTouchShowControls() {
  clearHideTimer();
  controlsVisible.value = true;
  startHideTimer();
}

function onClickOutside(e: MouseEvent) {
  if (speedDropdownOpen.value && speedDropdownRef.value && !speedDropdownRef.value.contains(e.target as Node)) {
    speedDropdownOpen.value = false;
  }
}

function onFullscreenChange() {
  isFullscreen.value = !!document.fullscreenElement;
  if (!document.fullscreenElement) {
    isLandscape.value = false;
    try { screen.orientation.unlock(); } catch (_) {}
  }
}

async function toggleOrientation() {
  try {
    if (isLandscape.value) {
      await (screen.orientation as any).lock('portrait');
      isLandscape.value = false;
    } else {
      await (screen.orientation as any).lock('landscape');
      isLandscape.value = true;
    }
  } catch (_) {
    showToast('当前浏览器不支持屏幕旋转');
  }
}

onMounted(() => {
  document.addEventListener("mousedown", onClickOutside);
  document.addEventListener("fullscreenchange", onFullscreenChange);
});

onUnmounted(() => {
  document.removeEventListener("mousedown", onClickOutside);
  document.removeEventListener("fullscreenchange", onFullscreenChange);
  if (controlsTimer) clearTimeout(controlsTimer);
});
</script>
