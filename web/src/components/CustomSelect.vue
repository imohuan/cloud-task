<template>
  <div v-click-outside="close" class="relative">
    <input
      type="text"
      class="pointer-events-none absolute top-0 left-0 z-[-1] h-full w-full opacity-0"
      tabindex="-1"
      :value="modelValue || ''"
      :required="required"
      aria-hidden="true"
    />
    <div
      class="flex w-full cursor-pointer items-center justify-between rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm transition-all"
      :class="{ 'border-blue-500 ring-2 ring-blue-100': open, 'hover:border-gray-400': !open }"
      @click="toggle"
    >
      <span :class="modelValue ? 'font-medium text-gray-800' : 'text-gray-400'">
        {{ displayLabel || placeholder }}
      </span>
      <ExpandMoreFilled
        class="h-3 w-3 text-gray-400 transition-transform duration-200"
        :class="{ 'rotate-180': open }"
      />
    </div>
    <Transition name="fade-slide">
      <div
        v-if="open"
        class="absolute top-full left-0 z-50 mt-1 w-full overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
      >
        <div
          v-for="opt in options"
          :key="opt.value"
          class="flex cursor-pointer items-center justify-between px-3 py-2 text-xs transition-colors"
          :class="
            modelValue === opt.value
              ? 'bg-blue-100 font-semibold text-blue-700'
              : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
          "
          @click="select(opt)"
        >
          <span>{{ opt.label }}</span>
          <CheckFilled v-if="modelValue === opt.value" class="h-2.5 w-2.5" />
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { ExpandMoreFilled, CheckFilled } from "@vicons/material";

interface Option {
  label: string;
  value: string | number;
}

const props = defineProps<{
  modelValue: string | number | null | undefined;
  options: Option[];
  placeholder?: string;
  required?: boolean;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: string | number | null): void;
}>();

const open = ref(false);

const displayLabel = computed(() => {
  const found = props.options.find((o) => o.value === props.modelValue);
  return found ? found.label : "";
});

const toggle = () => {
  open.value = !open.value;
};
const close = () => {
  open.value = false;
};

const select = (opt: Option) => {
  emit("update:modelValue", opt.value);
  open.value = false;
};

const vClickOutside = {
  mounted(el: HTMLElement, binding: { value: () => void }) {
    (el as any).__clickOutside__ = (event: Event) => {
      if (!(el === event.target || el.contains(event.target as Node))) {
        binding.value();
      }
    };
    document.addEventListener("mousedown", (el as any).__clickOutside__);
  },
  unmounted(el: HTMLElement) {
    document.removeEventListener("mousedown", (el as any).__clickOutside__);
  },
};
</script>
