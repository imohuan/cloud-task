<template>
  <Dropdown placement="top-start" :is-open="isOpen" @update:is-open="$emit('update:is-open', $event)">
    <template #trigger="{ isOpen: _openState }">
      <button :class="triggerClass">
        <span v-if="iconHtml" v-html="iconHtml"></span>
        <span>{{ triggerLabel }}</span>
      </button>
    </template>
    <template #default="{ close }">
      <div class="w-80 p-4">
        <div v-if="showSize && ratios?.length">
          <div class="mb-3 text-xs font-medium text-slate-500">选择比例</div>
          <div class="mb-4 grid grid-cols-3 gap-3">
            <button
              v-for="r in ratios"
              :key="r.id"
              @click="
                selectRatio(r);
                close();
              "
              :class="[
                'group flex h-28 flex-col items-center rounded-xl border p-3 transition-all',
                currentRatio?.id === r.id
                  ? 'border-blue-500 bg-blue-50/60 shadow-sm'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
              ]"
            >
              <div class="flex w-full flex-1 items-center justify-center">
                <div
                  class="rounded-lg transition-colors"
                  :class="[
                    currentRatio?.id === r.id ? 'bg-blue-400' : 'bg-slate-300 group-hover:bg-slate-400',
                    r.w === r.h ? 'h-10 w-10' : r.w > r.h ? 'h-9 w-14' : 'h-14 w-9',
                  ]"
                ></div>
              </div>
              <span
                class="mt-auto text-xs leading-none font-semibold"
                :class="currentRatio?.id === r.id ? 'text-blue-700' : 'text-slate-700'"
                >{{ r.label }}</span
              >
            </button>
          </div>
        </div>
        <div v-if="showResolution && resolutions?.length">
          <div class="mb-2 text-xs text-slate-400">选择分辨率</div>
          <div class="mb-4 flex gap-2">
            <button
              v-for="res in resolutions"
              :key="res.id"
              @click="
                selectResolution(res);
                close();
              "
              :class="[
                'flex-1 rounded-lg border py-2 text-center text-sm transition-colors',
                currentRes?.id === res.id
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-slate-200 text-slate-700 hover:bg-slate-50',
              ]"
            >
              {{ res.label }}
            </button>
          </div>
        </div>
        <div v-if="showDimension">
          <div class="mb-2 text-xs text-slate-400">尺寸</div>
          <div class="flex items-center gap-2">
            <div class="flex flex-1 items-center gap-2">
              <span class="w-3 text-xs text-slate-500">W</span>
              <input
                :value="customWidth"
                type="number"
                class="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-900 transition-colors outline-none focus:border-blue-500"
                @input="$emit('updateWidth', Number(($event.target as HTMLInputElement).value))"
              />
            </div>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="size-4 text-slate-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
              />
            </svg>
            <div class="flex flex-1 items-center gap-2">
              <span class="w-3 text-xs text-slate-500">H</span>
              <input
                :value="customHeight"
                type="number"
                class="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-900 transition-colors outline-none focus:border-blue-500"
                @input="$emit('updateHeight', Number(($event.target as HTMLInputElement).value))"
              />
            </div>
            <span class="text-xs text-slate-500">PX</span>
          </div>
        </div>
      </div>
    </template>
  </Dropdown>
</template>

<script setup lang="ts">
import { computed } from "vue";
import Dropdown from "@/components/dropdown/Dropdown.vue";

interface RatioItem {
  id: string;
  label: string;
  w: number;
  h: number;
}

interface ResItem {
  id: string;
  label: string;
}

const props = defineProps<{
  ratios?: RatioItem[];
  currentRatio?: RatioItem;
  resolutions?: ResItem[];
  currentRes?: ResItem;
  customWidth?: number;
  customHeight?: number;
  isOpen: boolean;
  showResolution?: boolean;
  showSize?: boolean;
  showDimension?: boolean;
  iconHtml?: string;
}>();

const emit = defineEmits<{
  (e: "update:is-open", v: boolean): void;
  (e: "selectRatio", ratio: RatioItem): void;
  (e: "selectRes", res: ResItem): void;
  (e: "updateWidth", v: number): void;
  (e: "updateHeight", v: number): void;
}>();

const triggerClass =
  "flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors";
const triggerLabel = computed(() => {
  const hasRatio = props.showSize && props.ratios?.length;
  const hasRes = props.showResolution && props.resolutions?.length;
  if (hasRatio && hasRes)
    return [props.currentRatio?.label || "自由比例", props.currentRes?.label || "标清 1K"].join(" ");
  if (hasRatio) return props.currentRatio?.label || "自由比例";
  if (hasRes) return props.currentRes?.label || "标清 1K";
  return "";
});

function selectRatio(r: RatioItem) {
  emit("selectRatio", r);
}
function selectResolution(r: ResItem) {
  emit("selectRes", r);
}
</script>
