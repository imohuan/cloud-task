import { ref, computed, watch, onMounted } from "vue";
import type { Ref } from "vue";

export function useMediaPlayer(
  mediaRef: Ref<HTMLMediaElement | null>,
  options: { initialVolume?: number; resetOnEnded?: boolean } = {},
) {
  const isPlaying = ref(false);
  const currentTime = ref(0);
  const duration = ref(0);
  const volume = ref(options.initialVolume ?? 0.7);
  const isMuted = ref(false);
  const playbackRate = ref(1.0);
  const seeking = ref(false);
  const rates = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return "0:00";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
      return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    }
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const progressPercent = computed(() => {
    return duration.value ? (currentTime.value / duration.value) * 100 : 0;
  });

  const volumeIcon = computed(() => {
    if (volume.value === 0 || isMuted.value) return "fa-solid fa-volume-mute";
    if (volume.value < 0.5) return "fa-solid fa-volume-down";
    return "fa-solid fa-volume-up";
  });

  function togglePlay() {
    if (!mediaRef.value) return;
    if (isPlaying.value) {
      mediaRef.value.pause();
      isPlaying.value = false;
    } else {
      mediaRef.value.play();
      isPlaying.value = true;
    }
  }

  function onTimeUpdate() {
    if (!seeking.value && mediaRef.value) {
      currentTime.value = mediaRef.value.currentTime;
      duration.value = mediaRef.value.duration || duration.value;
    }
  }

  function onLoadedMetadata() {
    if (mediaRef.value) {
      duration.value = mediaRef.value.duration;
    }
  }

  function onEnded() {
    isPlaying.value = false;
    if (options.resetOnEnded !== false) {
      currentTime.value = 0;
    }
  }

  function setPlaybackRate(rate: number) {
    playbackRate.value = rate;
    if (mediaRef.value) mediaRef.value.playbackRate = rate;
  }

  function toggleMute() {
    isMuted.value = !isMuted.value;
    if (mediaRef.value) mediaRef.value.muted = isMuted.value;
  }

  watch(volume, (newVal) => {
    if (mediaRef.value) {
      mediaRef.value.volume = newVal;
      if (newVal > 0) isMuted.value = false;
    }
  });

  onMounted(() => {
    if (mediaRef.value) {
      mediaRef.value.volume = volume.value;
    }
  });

  return {
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    playbackRate,
    seeking,
    rates,
    progressPercent,
    volumeIcon,
    formatTime,
    togglePlay,
    onTimeUpdate,
    onLoadedMetadata,
    onEnded,
    setPlaybackRate,
    toggleMute,
  };
}
