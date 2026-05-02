<template>
  <div class="py-0.5 font-sans">
    <!-- Toggle button -->
    <button class="flex items-center gap-1.5 text-[12px] text-gray-400 hover:text-gray-600 transition-colors"
      @click="collapsed = !collapsed">
      <!-- Chevron -->
      <svg v-if="showControls" class="w-3 h-3 transition-transform duration-200" :class="collapsed ? '' : 'rotate-90'" viewBox="0 0 16 16"
        fill="none" stroke="currentColor" stroke-width="2.5">
        <polyline points="5,3 11,8 5,13" />
      </svg>

      <!-- Label -->
      <span v-if="isStreaming" class="flex items-center gap-1.5">
        Thinking
        <svg class="w-3 h-3 animate-spin text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="2.5">
          <path
            d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
            stroke-linecap="round" />
        </svg>
      </span>
      <span v-else>Thought for {{ duration.toFixed(1) }}s</span>
    </button>

    <!-- Content -->
    <Transition
      @enter="onEnter"
      @after-enter="onAfterEnter"
      @leave="onLeave"
      @after-leave="onAfterLeave"
    >
      <div v-if="!collapsed" class="overflow-hidden">
        <div class="text-[13px] text-gray-500 italic my-1"
          :class="showControls ? 'border-l border-gray-200 pl-3 ml-1.5' : 'pl-2'">
          <slot />
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onUnmounted } from "vue";

function onEnter(el: Element) {
  const e = el as HTMLElement;
  e.style.height = "0";
  e.style.transition = "height 0.2s ease";
  requestAnimationFrame(() => { e.style.height = e.scrollHeight + "px"; });
}
function onAfterEnter(el: Element) {
  (el as HTMLElement).style.height = "";
}
function onLeave(el: Element) {
  const e = el as HTMLElement;
  e.style.height = e.scrollHeight + "px";
  e.style.transition = "height 0.2s ease";
  requestAnimationFrame(() => { e.style.height = "0"; });
}
function onAfterLeave(el: Element) {
  (el as HTMLElement).style.height = "";
}

const props = defineProps<{
  isStreaming: boolean;
  showControls?: boolean;
}>();

const collapsed = ref(true);
const duration = ref(0);

let timer: ReturnType<typeof setInterval> | null = null;

function startTimer() {
  duration.value = 0;
  timer = setInterval(() => {
    duration.value += 0.1;
  }, 100);
}

function stopTimer() {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
}

watch(
  () => props.isStreaming,
  (streaming) => {
    if (streaming) {
      collapsed.value = false;
      startTimer();
    } else {
      stopTimer();
      collapsed.value = true;
    }
  },
  { immediate: true },
);

onUnmounted(stopTimer);
</script>
