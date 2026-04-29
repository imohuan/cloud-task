<template>
  <Dropdown :placement="placement" :is-open="isOpen" @update:is-open="$emit('update:is-open', $event)">
    <template #trigger="{ isOpen: openState }">
      <button :class="triggerClass">
        <span
          v-if="resolvedIconHtml || currentItem?.iconHtml"
          v-html="resolvedIconHtml || currentItem?.iconHtml"
          :class="iconClass"
        ></span>
        <svg
          v-else-if="resolvedIcon || currentItem?.icon"
          xmlns="http://www.w3.org/2000/svg"
          :class="iconClass"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        <span>{{ labelText }}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          :class="[arrowClass, { 'rotate-180': openState }]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    </template>
    <template #default="{ close }">
      <div :class="contentClass">
        <div v-if="title" class="mb-1 px-3 py-1 text-[10px] text-slate-400">{{ title }}</div>
        <div :class="listClass">
          <button
            v-for="item in items"
            :key="item.id"
            :class="[itemClass, { 'bg-slate-100': currentValue === item.id }]"
            @click="handleSelect(item, close)"
          >
            <div class="flex items-center gap-3">
              <span v-if="item.iconHtml" v-html="item.iconHtml" :class="itemIconClass"></span>
              <svg
                v-else-if="item.icon"
                xmlns="http://www.w3.org/2000/svg"
                :class="itemIconClass"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <div>
                <div :class="itemLabelClass">{{ item.name || item.label }}</div>
                <div v-if="item.desc" class="text-xs text-slate-500">{{ item.desc }}</div>
              </div>
            </div>
            <svg
              v-if="currentValue === item.id"
              xmlns="http://www.w3.org/2000/svg"
              class="size-4 shrink-0 text-blue-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2.5"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </button>
        </div>
      </div>
    </template>
  </Dropdown>
</template>

<script setup lang="ts">
import { computed } from "vue";
import Dropdown from "@/components/dropdown/Dropdown.vue";
import type { Placement } from "@floating-ui/vue";

interface Item {
  id: string;
  name?: string;
  label?: string;
  desc?: string;
  icon?: unknown;
  iconHtml?: string;
}

const props = withDefaults(
  defineProps<{
    items?: Item[];
    currentValue?: string;
    label?: string;
    title?: string;
    icon?: unknown;
    iconHtml?: string;
    placement?: Placement;
    triggerClass?: string;
    iconClass?: string;
    arrowClass?: string;
    contentClass?: string;
    listClass?: string;
    itemClass?: string;
    itemIconClass?: string;
    itemLabelClass?: string;
    isOpen: boolean;
  }>(),
  {
    items: () => [],
    currentValue: "",
    label: "",
    title: "",
    iconHtml: "",
    placement: "top-start",
    triggerClass:
      "flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 hover:bg-slate-50",
    iconClass: "size-4",
    arrowClass: "size-4 transition-transform",
    contentClass: "w-48 p-2",
    listClass: "space-y-1",
    itemClass:
      "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-slate-50 transition-colors text-left",
    itemIconClass: "size-5",
    itemLabelClass: "text-sm font-medium text-slate-700",
  },
);

const emit = defineEmits<{
  (e: "select", item: Item): void;
  (e: "update:is-open", v: boolean): void;
}>();

const currentItem = computed(() => props.items.find((item) => item.id === props.currentValue));
const labelText = computed(() => {
  if (props.label) return props.label;
  return currentItem.value?.name || currentItem.value?.label || "";
});
const resolvedIcon = computed(() => {
  if (props.iconHtml || currentItem.value?.iconHtml) return null;
  return props.icon || currentItem.value?.icon;
});
const resolvedIconHtml = computed(() => props.iconHtml || currentItem.value?.iconHtml);

function handleSelect(item: Item, close?: () => void) {
  emit("select", item);
  close?.();
}
</script>
