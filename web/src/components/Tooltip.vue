<template>
  <div ref="triggerRef" class="relative inline-block" @mouseenter="show = true" @mouseleave="show = false">
    <slot />
    <Teleport to="body">
      <Transition
        enter-active-class="transition-opacity duration-150"
        leave-active-class="transition-opacity duration-100"
        enter-from-class="opacity-0"
        leave-to-class="opacity-0"
      >
        <div
          v-if="show && content"
          ref="floatingRef"
          class="pointer-events-none z-[9999] max-w-[200px] rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs leading-snug text-slate-700 shadow-md"
          :style="floatingStyles"
        >
          {{ content }}
          <div
            class="absolute h-0 w-0 border-4 border-transparent"
            :style="arrowStyle"
          ></div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useFloating, offset, flip, shift, autoUpdate } from "@floating-ui/vue";
import type { Placement } from "@floating-ui/vue";

const props = defineProps<{
  content?: string;
  placement?: Placement;
}>();

const show = ref(false);
const triggerRef = ref<HTMLElement | null>(null);
const floatingRef = ref<HTMLElement | null>(null);

const middleware = computed(() => [
  offset(8),
  flip(),
  shift({ padding: 6 }),
]);

const { floatingStyles, placement: resolvedPlacement } = useFloating(triggerRef, floatingRef, {
  placement: computed(() => props.placement ?? "top"),
  middleware,
  strategy: "fixed",
  whileElementsMounted: autoUpdate,
});

const arrowStyle = computed(() => {
  const p = resolvedPlacement.value;
  if (p.startsWith("top")) return { top: "100%", left: "50%", transform: "translateX(-50%)", borderTopColor: "#ffffff" };
  if (p.startsWith("bottom")) return { bottom: "100%", left: "50%", transform: "translateX(-50%)", borderBottomColor: "#ffffff" };
  if (p.startsWith("left")) return { left: "100%", top: "50%", transform: "translateY(-50%)", borderLeftColor: "#ffffff" };
  return { right: "100%", top: "50%", transform: "translateY(-50%)", borderRightColor: "#ffffff" };
});
</script>
