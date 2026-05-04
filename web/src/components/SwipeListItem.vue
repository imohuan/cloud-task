<template>
  <div class="relative overflow-hidden" ref="rootRef">
    <!-- Right action area revealed by swipe -->
    <div
      class="absolute inset-y-0 right-0 flex w-[60px] items-center justify-center rounded-r-lg bg-red-500"
      :style="{ opacity: displayOffset > 0 ? 1 : 0 }"
    >
      <button
        class="flex h-full w-full flex-col items-center justify-center gap-0.5 rounded-r-lg text-white active:bg-red-600"
        @click.stop="emit('delete')"
      >
        <slot name="action">
          <DeleteFilled class="h-4 w-4" />
          <span class="text-[10px] font-medium leading-none">删除</span>
        </slot>
      </button>
    </div>

    <!-- Content slides left on swipe -->
    <div
      :style="{
        transform: `translateX(${-displayOffset}px)`,
        transition: isDragging ? 'none' : 'transform 0.25s cubic-bezier(0.25,0.46,0.45,0.94)',
      }"
      @touchstart.passive="onTouchStart"
      @touchmove="onTouchMove"
      @touchend.passive="onTouchEnd"
    >
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { DeleteFilled } from "@vicons/material";

const REVEAL_WIDTH = 60;
const SNAP_THRESHOLD = 24;

const emit = defineEmits<{ (e: "delete"): void }>();

const rootRef = ref<HTMLElement | null>(null);
const isRevealed = ref(false);
const isDragging = ref(false);
const dragLeft = ref(0);
let startX = 0;
let startY = 0;
let direction: "h" | "v" | null = null;

const displayOffset = computed(() => {
  if (!isDragging.value) return isRevealed.value ? REVEAL_WIDTH : 0;
  const base = isRevealed.value ? REVEAL_WIDTH : 0;
  return Math.min(REVEAL_WIDTH, Math.max(0, base + dragLeft.value));
});

const onTouchStart = (e: TouchEvent) => {
  const t = e.touches[0];
  if (!t) return;
  startX = t.clientX;
  startY = t.clientY;
  direction = null;
  dragLeft.value = 0;
  isDragging.value = true;
};

const onTouchMove = (e: TouchEvent) => {
  const t = e.touches[0];
  if (!t || !isDragging.value) return;
  const dx = startX - t.clientX;
  const dy = Math.abs(t.clientY - startY);
  if (direction === null) {
    if (Math.abs(dx) > 6 || dy > 6) direction = Math.abs(dx) > dy ? "h" : "v";
    return;
  }
  if (direction === "h") {
    e.preventDefault();
    dragLeft.value = dx;
  }
};

const onTouchEnd = () => {
  if (!isDragging.value) return;
  isDragging.value = false;
  const base = isRevealed.value ? REVEAL_WIDTH : 0;
  const final = Math.min(REVEAL_WIDTH, Math.max(0, base + dragLeft.value));
  isRevealed.value = final >= SNAP_THRESHOLD;
  dragLeft.value = 0;
};

const close = () => {
  isRevealed.value = false;
};

const onOutsideClick = (e: MouseEvent | TouchEvent) => {
  if (isRevealed.value && rootRef.value && !rootRef.value.contains(e.target as Node)) {
    close();
  }
};

onMounted(() => document.addEventListener("touchstart", onOutsideClick, { passive: true }));
onUnmounted(() => document.removeEventListener("touchstart", onOutsideClick));

defineExpose({ close });
</script>
