<template>
  <div class="space-y-2">
    <div class="relative">
      <input
        ref="inputRef"
        v-model="inputValue"
        type="text"
        :placeholder="placeholder"
        class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-700 placeholder-slate-400 transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none"
        @input="onInput"
        @keydown="onKeyDown"
        @focus="onFocus"
        @blur="onBlur"
      />
      <Transition name="dropdown">
        <div
          v-if="isOpen && filteredSuggestions.length"
          class="absolute top-full left-0 right-0 z-20 mt-1 max-h-44 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl"
        >
          <div
            v-for="(s, i) in filteredSuggestions"
            :key="s.id"
            :ref="(el) => setItemRef(el, i)"
            class="flex cursor-pointer items-center justify-between px-3 py-2 transition-colors"
            :class="i === activeIndex ? 'bg-blue-50' : 'hover:bg-slate-50'"
            @mousedown.prevent="selectSuggestion(s)"
          >
            <div class="min-w-0 flex-1">
              <div class="truncate font-mono text-xs font-medium text-slate-700">{{ s.id }}</div>
              <div v-if="s.description" class="line-clamp-1 text-[10px] text-slate-400">{{ s.description }}</div>
            </div>
            <span
              v-if="s.model_type"
              class="ml-2 shrink-0 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-500"
            >{{ s.model_type }}</span>
          </div>
        </div>
      </Transition>
    </div>

    <div v-if="modelValue.length" class="flex flex-wrap gap-1.5">
      <span
        v-for="(m, i) in modelValue"
        :key="m"
        class="flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-blue-700"
      >
        {{ m }}
        <button
          type="button"
          class="flex h-3.5 w-3.5 items-center justify-center rounded-full text-blue-400 transition-colors hover:bg-blue-200 hover:text-blue-700"
          @click="removeModel(i)"
        >
          <CloseFilled class="h-2.5 w-2.5" />
        </button>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { CloseFilled } from "@vicons/material";

interface Suggestion {
  id: string;
  description?: string;
  model_type?: string;
}

const props = withDefaults(
  defineProps<{
    modelValue: string[];
    suggestions?: Suggestion[];
    placeholder?: string;
  }>(),
  {
    suggestions: () => [],
    placeholder: "输入模型 ID，按 Enter 添加",
  },
);

const emit = defineEmits<{
  (e: "update:modelValue", value: string[]): void;
}>();

const inputValue = ref("");
const isOpen = ref(false);
const activeIndex = ref(-1);
const itemRefs = ref<(Element | null)[]>([]);

const setItemRef = (el: unknown, i: number) => {
  itemRefs.value[i] = el as Element | null;
};

watch(activeIndex, (i) => {
  if (i >= 0) itemRefs.value[i]?.scrollIntoView({ block: 'nearest' });
});

const filteredSuggestions = computed(() => {
  const q = inputValue.value.trim().toLowerCase();
  return props.suggestions.filter(
    (s) =>
      !props.modelValue.includes(s.id) &&
      (!q || s.id.toLowerCase().includes(q) || s.description?.toLowerCase().includes(q)),
  );
});

const openDropdown = () => {
  if (props.suggestions.length) isOpen.value = true;
};

const closeDropdown = () => {
  isOpen.value = false;
  activeIndex.value = -1;
};

const onFocus = () => openDropdown();
const onBlur = () => setTimeout(closeDropdown, 150);

const onInput = () => {
  activeIndex.value = -1;
  if (props.suggestions.length) {
    isOpen.value = filteredSuggestions.value.length > 0;
  }
};

const addModel = (id: string) => {
  const val = id.trim();
  if (!val || props.modelValue.includes(val)) return;
  emit("update:modelValue", [...props.modelValue, val]);
  inputValue.value = "";
  closeDropdown();
};

const selectSuggestion = (s: Suggestion) => addModel(s.id);

const removeModel = (index: number) => {
  const updated = [...props.modelValue];
  updated.splice(index, 1);
  emit("update:modelValue", updated);
};

const onKeyDown = (e: KeyboardEvent) => {
  const len = filteredSuggestions.value.length;
  switch (e.key) {
    case "ArrowDown":
      e.preventDefault();
      if (!isOpen.value) { openDropdown(); break; }
      activeIndex.value = activeIndex.value < len - 1 ? activeIndex.value + 1 : 0;
      break;
    case "ArrowUp":
      e.preventDefault();
      activeIndex.value = activeIndex.value > 0 ? activeIndex.value - 1 : len - 1;
      break;
    case "Enter":
      e.preventDefault();
      if (isOpen.value && activeIndex.value >= 0 && filteredSuggestions.value[activeIndex.value]) {
        const s = filteredSuggestions.value[activeIndex.value];
        if (s) selectSuggestion(s);
      } else {
        addModel(inputValue.value);
      }
      break;
    case "Escape":
      e.preventDefault();
      closeDropdown();
      break;
  }
};
</script>

<style scoped>
.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity 0.1s ease, transform 0.1s ease;
}
.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
