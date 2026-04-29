<template>
  <div ref="triggerRef" class="relative inline-block" @mouseenter="onTriggerEnter" @mouseleave="onTriggerLeave">
    <div @click="toggle">
      <slot name="trigger" :is-open="props.isOpen" />
    </div>
    <Teleport to="body">
      <div
        v-show="props.isOpen"
        ref="floatingRef"
        class="z-[9999] rounded-xl border border-slate-200 bg-white"
        :style="floatingStyles"
        @mouseenter="onPanelEnter"
        @mouseleave="onPanelLeave"
      >
        <slot :close="closeDropdown" />
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useFloating, offset, flip, shift, autoUpdate } from "@floating-ui/vue";
import type { Placement } from "@floating-ui/vue";

const props = defineProps<{
  placement?: Placement;
  offset?: number;
  isOpen: boolean;
  useHover?: boolean;
}>();

const emit = defineEmits<{
  (e: "update:is-open", v: boolean): void;
}>();

const triggerRef = ref<HTMLElement | null>(null);
const floatingRef = ref<HTMLElement | null>(null);

const middleware = computed(() => [offset(props.offset ?? 8), flip(), shift({ padding: 8 })]);

const { floatingStyles } = useFloating(triggerRef, floatingRef, {
  placement: computed(() => props.placement ?? "bottom-start"),
  middleware,
  strategy: "fixed",
  whileElementsMounted: autoUpdate,
});

let closeTimer: ReturnType<typeof setTimeout> | null = null;

function clearCloseTimer() {
  if (closeTimer) {
    clearTimeout(closeTimer);
    closeTimer = null;
  }
}

function toggle() {
  emit("update:is-open", !props.isOpen);
}

function handleClickOutside(e: MouseEvent) {
  if (!props.isOpen) return;
  const t = e.target as Node;
  if (triggerRef.value && !triggerRef.value.contains(t) && floatingRef.value && !floatingRef.value.contains(t)) {
    emit("update:is-open", false);
  }
}

function onTriggerEnter() {
  if (!props.useHover) return;
  clearCloseTimer();
  emit("update:is-open", true);
}

function onTriggerLeave() {
  if (!props.useHover) return;
  closeTimer = setTimeout(() => {
    emit("update:is-open", false);
  }, 150);
}

function onPanelEnter() {
  if (!props.useHover) return;
  clearCloseTimer();
}

function onPanelLeave() {
  if (!props.useHover) return;
  closeTimer = setTimeout(() => {
    emit("update:is-open", false);
  }, 150);
}

function closeDropdown() {
  emit("update:is-open", false);
}

onMounted(() => document.addEventListener("click", handleClickOutside));
onUnmounted(() => {
  document.removeEventListener("click", handleClickOutside);
  clearCloseTimer();
});
</script>
