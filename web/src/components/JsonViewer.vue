<template>
  <div class="json-viewer font-mono text-[13px] leading-[1.6rem]">
    <div v-if="!isComplex" class="group flex items-start rounded-sm transition-colors hover:bg-slate-50/50">
      <div class="w-[18px] shrink-0" />
      <div class="flex-1 break-words">
        <span v-if="nodeKey !== null" class="mr-1.5 cursor-text text-slate-700">
          <span class="text-slate-500">'</span>{{ nodeKey }}<span class="text-slate-500">'</span
          ><span class="text-slate-500">:</span>
        </span>
        <span :class="valueColorClass" class="whitespace-pre-wrap">{{ formatValue(data) }}</span>
        <span v-if="!isLast" class="text-slate-500">,</span>
      </div>
    </div>

    <div v-else class="group/tree relative">
      <div class="flex items-start rounded-sm transition-colors" :class="{ 'hover:bg-slate-50/80': !isRoot }">
        <div
          class="relative z-10 flex h-[1.6rem] w-[18px] shrink-0 cursor-pointer items-center justify-center"
          :class="{ invisible: isEmpty }"
          @click="toggle"
        >
          <ChevronRightFilled
            class="h-2 w-2 text-slate-400 transition-transform duration-200"
            :class="{ 'rotate-90': isExpanded, 'text-indigo-400': isRoot && !isExpanded }"
          />
        </div>
        <div class="flex flex-1 cursor-pointer flex-wrap items-center select-none" @click="toggle">
          <span v-if="nodeKey !== null" class="mr-1.5 text-slate-700">
            <span class="text-slate-500">'</span>{{ nodeKey }}<span class="text-slate-500">'</span
            ><span class="text-slate-500">:</span>
          </span>
          <span class="text-slate-500">{{ openBracket }}</span>
          <template v-if="!isExpanded && !isEmpty">
            <span v-if="dataType === 'array'" class="mx-1 text-[10px] tracking-widest text-slate-400">...</span>
            <span v-else class="mx-1.5 text-[11px] text-slate-400 italic transition-colors hover:text-indigo-400">
              {{ itemCount }} items
            </span>
          </template>
          <span v-if="!isExpanded || isEmpty" class="text-slate-500">
            <span v-if="!isExpanded && dataType === 'array' && !isEmpty"> </span>{{ closeBracket
            }}<span v-if="!isLast">,</span>
          </span>
        </div>
      </div>

      <div v-show="isExpanded && !isEmpty" class="relative">
        <div
          class="absolute top-0 bottom-0 left-[8px] z-0 w-px bg-slate-200 transition-colors group-hover/tree:bg-slate-300"
        />
        <div class="relative z-10 pl-[18px]">
          <JsonViewer
            v-for="(val, key, index) in parsedData as any"
            :key="key"
            :node-key="dataType === 'array' ? null : key"
            :data="val"
            :is-last="
              index ===
              (dataType === 'array' ? (parsedData as any[]).length : Object.keys(parsedData as object).length) - 1
            "
            :expand-trigger="expandTrigger"
            :is-root="false"
          />
        </div>
      </div>

      <div v-show="isExpanded && !isEmpty" class="flex items-start rounded-sm group-hover/tree:bg-slate-50/30">
        <div class="w-[18px] shrink-0" />
        <div class="text-slate-500">{{ closeBracket }}<span v-if="!isLast">,</span></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { ChevronRightFilled } from "@vicons/material";

const props = withDefaults(
  defineProps<{
    data: unknown;
    nodeKey?: string | number | null;
    isLast?: boolean;
    isRoot?: boolean;
    expandTrigger?: number;
  }>(),
  {
    nodeKey: null,
    isLast: false,
    isRoot: false,
    expandTrigger: 0,
  },
);

const isExpanded = ref(props.isRoot || props.expandTrigger > 0);

const toggle = () => {
  isExpanded.value = !isExpanded.value;
};

const parsedData = computed(() => {
  if (typeof props.data === "string") {
    const trimmed = props.data.trim();
    if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
      try {
        return JSON.parse(trimmed);
      } catch {
        // ignore parse error, return original string
      }
    }
  }
  return props.data;
});

const dataType = computed(() => {
  const val = parsedData.value;
  if (val === null) return "null";
  if (Array.isArray(val)) return "array";
  return typeof val;
});

const isComplex = computed(() => dataType.value === "object" || dataType.value === "array");

const isEmpty = computed(() => {
  if (dataType.value === "object") return Object.keys(parsedData.value as object).length === 0;
  if (dataType.value === "array") return (parsedData.value as unknown[]).length === 0;
  return false;
});

const itemCount = computed(() => {
  if (dataType.value === "object") return Object.keys(parsedData.value as object).length;
  if (dataType.value === "array") return (parsedData.value as unknown[]).length;
  return 0;
});

const openBracket = computed(() => (dataType.value === "array" ? "[" : "{"));
const closeBracket = computed(() => (dataType.value === "array" ? "]" : "}"));

const formatValue = (val: unknown) => {
  if (val === null) return "null";
  if (typeof val === "boolean") return val ? "true" : "false";
  if (typeof val === "string") return `"${val}"`;
  if (typeof val === "number") return String(val);
  return val as any;
};

const valueColorClass = computed(() => {
  switch (dataType.value) {
    case "string":
      return "text-red-700";
    case "boolean":
    case "null":
      return "text-teal-700 font-medium";
    case "number":
      return "text-blue-600";
    default:
      return "text-slate-800";
  }
});

watch(
  () => props.expandTrigger,
  (val) => {
    if (val && val > 0) isExpanded.value = true;
    if (val && val < 0) isExpanded.value = false;
  },
);
</script>
