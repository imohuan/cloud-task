<template>
  <Dropdown placement="bottom-start" :is-open="isOpen" @update:is-open="handleUpdateIsOpen">
    <template #trigger="{ isOpen: open }">
      <div
        class="flex min-w-0 cursor-pointer items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 transition-colors hover:border-blue-300 hover:bg-blue-100"
        :class="{ 'border-blue-300 bg-blue-100': open }"
      >
        <span class="shrink-0 text-xs font-semibold text-blue-600">时间范围</span>
        <span class="truncate text-xs text-blue-500" :class="isMobile ? 'max-w-[160px]' : ''">
          {{ timeStartMs !== undefined ? (isMobile ? formatTimestampMobile(timeStartMs) : formatTimestamp(timeStartMs)) : '' }}
          <template v-if="timeEndMs !== undefined"> — {{ isMobile ? formatTimestampMobile(timeEndMs) : formatTimestamp(timeEndMs) }}</template>
          <template v-else> — 至今</template>
        </span>
        <KeyboardArrowDownRound
          class="h-3.5 w-3.5 shrink-0 text-blue-400 transition-transform duration-200"
          :class="{ 'rotate-180': open }"
        />
      </div>
    </template>

    <template #default="{ close }">
      <div class="w-72 overflow-hidden shadow-lg">
        <!-- 头部 -->
        <div class="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-2.5">
          <span class="text-[11px] font-bold tracking-wider text-slate-400 uppercase">选择时间范围</span>
          <button @click.stop="close" class="text-slate-400 hover:text-slate-600">
            <CloseRound class="h-4 w-4" />
          </button>
        </div>

        <!-- 快捷选择 -->
        <div class="grid grid-cols-3 gap-1.5 border-b border-slate-100 p-3">
          <button
            v-for="preset in presets"
            :key="preset.label"
            @click.stop="applyPreset(preset, close)"
            class="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600"
          >
            {{ preset.label }}
          </button>
        </div>

        <!-- 时间输入 -->
        <div class="space-y-3 p-4">
          <div>
            <label class="mb-1.5 block text-[11px] font-bold tracking-wider text-slate-400 uppercase">开始时间</label>
            <input
              type="datetime-local"
              v-model="localStart"
              class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm transition-all focus:border-blue-500 focus:bg-white focus:outline-none"
            />
          </div>
          <div>
            <label class="mb-1.5 block text-[11px] font-bold tracking-wider text-slate-400 uppercase">结束时间</label>
            <input
              type="datetime-local"
              v-model="localEnd"
              :disabled="endIsNow"
              class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm transition-all focus:border-blue-500 focus:bg-white focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
            />
            <label class="mt-1.5 flex cursor-pointer items-center gap-1.5 select-none">
              <input type="checkbox" v-model="endIsNow" class="h-3.5 w-3.5 accent-blue-600" />
              <span class="text-xs text-slate-500">至今（不限结束时间）</span>
            </label>
          </div>
        </div>

        <!-- 底部操作 -->
        <div class="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-4 py-3">
          <button
            @click.stop="close"
            class="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-500 transition-colors hover:bg-slate-100"
          >
            取消
          </button>
          <button
            @click.stop="handleApply(close)"
            :disabled="!localStart"
            class="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            应用
          </button>
        </div>
      </div>
    </template>
  </Dropdown>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { KeyboardArrowDownRound, CloseRound } from "@vicons/material";
import Dropdown from "@/components/dropdown/Dropdown.vue";

const props = defineProps<{
  isOpen: boolean;
  timeStartMs: number | undefined;
  timeEndMs: number | undefined;
  isMobile: boolean;
}>();

const emit = defineEmits<{
  toggle: [];
  change: [startMs: number, endMs: number | undefined];
}>();

const localStart = ref("");
const localEnd = ref("");
const endIsNow = ref(false);

const presets: { label: string; startOffset: number; endIsNow: boolean }[] = [
  { label: "最近1小时", startOffset: 60 * 60 * 1000, endIsNow: true },
  { label: "最近6小时", startOffset: 6 * 60 * 60 * 1000, endIsNow: true },
  { label: "最近12小时", startOffset: 12 * 60 * 60 * 1000, endIsNow: true },
  { label: "最近1天", startOffset: 24 * 60 * 60 * 1000, endIsNow: true },
  { label: "最近3天", startOffset: 3 * 24 * 60 * 60 * 1000, endIsNow: true },
  { label: "最近7天", startOffset: 7 * 24 * 60 * 60 * 1000, endIsNow: true },
  { label: "最近14天", startOffset: 14 * 24 * 60 * 60 * 1000, endIsNow: true },
  { label: "最近1个月", startOffset: 30 * 24 * 60 * 60 * 1000, endIsNow: true },
  { label: "最近3个月", startOffset: 90 * 24 * 60 * 60 * 1000, endIsNow: true },
];

function applyPreset(preset: (typeof presets)[number], close: () => void) {
  const now = Date.now();
  emit("change", now - preset.startOffset, preset.endIsNow ? undefined : now);
  close();
}

function msToDatetimeLocal(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

watch(
  () => props.isOpen,
  (open) => {
    if (!open) return;
    localStart.value = props.timeStartMs !== undefined ? msToDatetimeLocal(props.timeStartMs) : "";
    if (props.timeEndMs !== undefined) {
      localEnd.value = msToDatetimeLocal(props.timeEndMs);
      endIsNow.value = false;
    } else {
      localEnd.value = "";
      endIsNow.value = true;
    }
  },
);

function handleApply(close: () => void) {
  if (!localStart.value) return;
  const startMs = new Date(localStart.value).getTime();
  const endMs = endIsNow.value || !localEnd.value ? undefined : new Date(localEnd.value).getTime();
  emit("change", startMs, endMs);
  close();
}

function handleUpdateIsOpen(value: boolean) {
  if (value !== props.isOpen) emit("toggle");
}

function formatTimestamp(ms: number): string {
  return new Date(ms).toLocaleString();
}

function formatTimestampMobile(ms: number): string {
  return new Date(ms).toLocaleTimeString();
}
</script>
