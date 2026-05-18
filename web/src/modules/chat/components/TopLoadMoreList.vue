<template>
  <div
    ref="containerRef"
    class="scrollbar-lager relative flex-1 overflow-y-auto"
    @scroll.passive="onScroll"
    @wheel.passive="onWheel"
    @touchstart.passive="onTouchStart"
    @touchmove.passive="onTouchMove"
    @touchend.passive="onTouchEnd"
    @touchcancel.passive="onTouchEnd"
  >
    <div class="flex justify-center py-2">
      <div class="text-xs text-slate-500">
        <i v-if="loading" class="fa-solid fa-spinner mr-1 animate-spin" />
        <i v-else-if="!hasMore" class="fa-solid fa-check mr-1" />
        <i v-else class="fa-solid fa-arrow-up mr-1" />
        <span>{{ indicatorText }}</span>
      </div>
    </div>

    <slot :container-ref="containerRef" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";

const props = withDefaults(defineProps<{
  loading?: boolean;
  hasMore?: boolean;
  hasItems?: boolean;
  triggerDistance?: number;
  topThreshold?: number;
}>(), {
  loading: false,
  hasMore: true,
  hasItems: false,
  triggerDistance: 56,
  topThreshold: 2,
});

const emit = defineEmits<{
  (e: "load-more"): void;
  (e: "container-ready", container: HTMLElement | null): void;
}>();

const containerRef = ref<HTMLElement | null>(null);
const touchStartY = ref<number | null>(null);
const pullDistance = ref(0);
const lastScrollTop = ref(0);
const reachedTopByUpwardScroll = ref(false);
let lock = false;

watch(containerRef, (el) => {
  emit("container-ready", el);
  lastScrollTop.value = el?.scrollTop || 0;
}, { immediate: true });

const indicatorText = computed(() => {
  if (!props.hasItems) return "暂无可加载内容";
  if (props.loading) return "加载中...";
  if (!props.hasMore) return "没有更多了";
  if (pullDistance.value >= props.triggerDistance) return "松开加载更多";
  return "上滑到顶部加载更多";
});

function isAtTop() {
  const el = containerRef.value;
  if (!el) return false;
  return el.scrollTop <= props.topThreshold;
}

function canTryLoadMore() {
  return !lock && props.hasItems && !props.loading && props.hasMore;
}

function tryLoadMore() {
  if (!canTryLoadMore() || !reachedTopByUpwardScroll.value) return;
  lock = true;
  reachedTopByUpwardScroll.value = false;
  emit("load-more");
  setTimeout(() => {
    lock = false;
  }, 450);
}

function onScroll() {
  const el = containerRef.value;
  if (!el) return;

  const currentTop = el.scrollTop;
  const scrollingUp = currentTop < lastScrollTop.value;

  if (scrollingUp && currentTop <= props.topThreshold) {
    reachedTopByUpwardScroll.value = true;
  }

  if (currentTop > props.topThreshold) {
    reachedTopByUpwardScroll.value = false;
  }

  lastScrollTop.value = currentTop;
}

function onWheel(e: WheelEvent) {
  if (!canTryLoadMore()) return;
  if (e.deltaY >= 0) return;
  if (!isAtTop()) return;
  if (!reachedTopByUpwardScroll.value) return;
  tryLoadMore();
}

function onTouchStart(e: TouchEvent) {
  touchStartY.value = e.touches[0]?.clientY ?? null;
}

function onTouchMove(e: TouchEvent) {
  const el = containerRef.value;
  if (!el || touchStartY.value === null) return;

  const currentY = e.touches[0]?.clientY ?? touchStartY.value;
  const delta = currentY - touchStartY.value;

  if (el.scrollTop > props.topThreshold) {
    pullDistance.value = 0;
    return;
  }

  pullDistance.value = delta > 0 ? Math.min(delta, 96) : 0;
}

function onTouchEnd() {
  if (!canTryLoadMore()) {
    pullDistance.value = 0;
    touchStartY.value = null;
    return;
  }

  if (pullDistance.value >= props.triggerDistance && reachedTopByUpwardScroll.value) {
    tryLoadMore();
  }

  pullDistance.value = 0;
  touchStartY.value = null;
}
</script>