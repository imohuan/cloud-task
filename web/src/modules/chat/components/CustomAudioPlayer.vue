<template>
  <div class="relative overflow-hidden rounded-xl border border-gray-200 bg-white p-4">
    <audio
      ref="audioRef"
      :src="src"
      class="hidden"
      @timeupdate="onTimeUpdate"
      @loadedmetadata="onTimeUpdate"
      @ended="onEnded"
    ></audio>
    <div class="flex items-center gap-3">
      <button
        @click="togglePlay"
        class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm transition-colors hover:bg-blue-700"
      >
        <i class="text-sm" :class="[isPlaying ? 'fas fa-pause' : 'fas fa-play', !isPlaying ? 'ml-0.5' : '']"></i>
      </button>
      <div class="flex min-w-0 flex-1 items-center gap-2.5">
        <span class="w-10 flex-shrink-0 text-right font-mono text-[10px] font-medium text-gray-500">{{
          formatTime(currentTime)
        }}</span>
        <div class="group/bar relative flex h-6 flex-1 cursor-pointer items-center" @mousedown="onSeekBarMouseDown">
          <div class="absolute h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              class="absolute h-full rounded-full bg-blue-600 transition-[width] duration-100"
              :style="{ width: progressPercent + '%' }"
            ></div>
          </div>
          <div
            class="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-blue-600 opacity-0 shadow transition-opacity group-hover/bar:opacity-100"
            :style="{ left: 'calc(' + progressPercent + '% - 6px)' }"
          ></div>
        </div>
        <span class="w-10 flex-shrink-0 font-mono text-[10px] font-medium text-gray-400">{{
          formatTime(duration)
        }}</span>
      </div>
      <div class="group/volume flex flex-shrink-0 items-center gap-1">
        <button
          @click="toggleMute"
          class="flex h-7 w-7 items-center justify-center text-gray-500 transition-colors hover:text-gray-700"
        >
          <i :class="volumeIcon" class="text-xs"></i>
        </button>
        <div class="flex w-0 items-center overflow-hidden transition-all duration-300 group-hover/volume:w-16">
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            v-model="volume"
            class="range-audio-volume h-1 w-14 cursor-pointer appearance-none rounded-full bg-gray-300"
          />
        </div>
      </div>
      <div class="relative flex-shrink-0" ref="speedDropdownRef">
        <button
          @click="speedDropdownOpen = !speedDropdownOpen"
          class="rounded-lg border border-gray-200 px-2 py-1 text-[10px] font-bold text-gray-600 transition-colors hover:bg-gray-50"
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
    </div>
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
}>();

const audioRef = ref<HTMLAudioElement | null>(null);
const speedDropdownOpen = ref(false);
const speedDropdownRef = ref<HTMLElement | null>(null);
let draggingBar: HTMLElement | null = null;

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
  togglePlay,
  onTimeUpdate,
  onEnded,
  setPlaybackRate: baseSetPlaybackRate,
  toggleMute,
} = useMediaPlayer(audioRef, { initialVolume: 0.7 });

const { toasts, showToast } = useToast();

function seek(event: MouseEvent) {
  if (!audioRef.value || !audioRef.value.duration) return;
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  const x = Math.max(0, Math.min(event.clientX - rect.left, rect.width));
  audioRef.value.currentTime = (x / rect.width) * audioRef.value.duration;
}

function onSeekBarMouseDown(event: MouseEvent) {
  event.preventDefault();
  seeking.value = true;
  draggingBar = event.currentTarget as HTMLElement;
  seek(event);
  document.addEventListener("mousemove", onSeekBarMouseMove);
  document.addEventListener("mouseup", onSeekBarMouseUp);
}

function onSeekBarMouseMove(event: MouseEvent) {
  if (!seeking.value || !draggingBar) return;
  const rect = draggingBar.getBoundingClientRect();
  const x = Math.max(0, Math.min(event.clientX - rect.left, rect.width));
  if (audioRef.value && audioRef.value.duration) {
    audioRef.value.currentTime = (x / rect.width) * audioRef.value.duration;
  }
}

function onSeekBarMouseUp() {
  seeking.value = false;
  draggingBar = null;
  document.removeEventListener("mousemove", onSeekBarMouseMove);
  document.removeEventListener("mouseup", onSeekBarMouseUp);
}

function setPlaybackRate(rate: number) {
  baseSetPlaybackRate(rate);
  speedDropdownOpen.value = false;
  showToast(`播放速度: ${rate}x`);
}

function onClickOutside(e: MouseEvent) {
  if (speedDropdownOpen.value && speedDropdownRef.value && !speedDropdownRef.value.contains(e.target as Node)) {
    speedDropdownOpen.value = false;
  }
}

onMounted(() => document.addEventListener("mousedown", onClickOutside));
onUnmounted(() => {
  document.removeEventListener("mousedown", onClickOutside);
  if (draggingBar) onSeekBarMouseUp();
});
</script>
