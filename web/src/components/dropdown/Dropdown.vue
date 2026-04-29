<template>
  <div ref="triggerRef" class="relative inline-block" @mouseenter="onTriggerEnter" @mouseleave="onTriggerLeave">
    <div @click="toggle">
      <slot name="trigger" :is-open="props.isOpen" />
    </div>
    <Teleport to="body">
      <div
        v-show="props.isOpen && isReady"
        ref="dropdownRef"
        class="fixed z-[9999] rounded-xl border border-slate-200 bg-white"
        :style="dropdownStyle"
        @mouseenter="onPanelEnter"
        @mouseleave="onPanelLeave"
      >
        <slot :close="closeDropdown" />
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, onMounted, onUnmounted, watch } from "vue";
import { useDropdownPosition } from "./useDropdownPosition";

const props = defineProps<{
  placement?: string;
  offset?: number;
  isOpen: boolean;
  useHover?: boolean;
}>();

const emit = defineEmits<{
  (e: "update:is-open", v: boolean): void;
}>();

const isReady = ref(false);
const { triggerRef, dropdownRef, dropdownStyle, updatePosition } = useDropdownPosition({
  placement: props.placement || "top-start",
  offset: props.offset ?? 8,
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

function open() {
  isReady.value = false;
  dropdownStyle.value = {};
  nextTick(() => {
    requestAnimationFrame(() => {
      isReady.value = true;
      nextTick(() => {
        requestAnimationFrame(() => {
          updatePosition();
        });
      });
    });
  });
}

function close() {
  isReady.value = false;
  dropdownStyle.value = {};
}

function handleClickOutside(e: MouseEvent) {
  if (!props.isOpen) return;
  const t = e.target as Node;
  if (triggerRef.value && !triggerRef.value.contains(t) && dropdownRef.value && !dropdownRef.value.contains(t)) {
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

watch(
  () => props.isOpen,
  (v) => {
    v ? open() : close();
  },
);
</script>
