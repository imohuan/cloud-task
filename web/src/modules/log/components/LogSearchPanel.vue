<template>
  <div class="relative" ref="panelRef">
    <div
      @click="$emit('toggle')"
      class="flex cursor-pointer items-center gap-2 rounded-lg border border-transparent bg-slate-50 px-3 py-1.5 transition-colors hover:border-slate-200 hover:bg-slate-100"
      :class="{ 'border-slate-200 bg-slate-100': isOpen }"
    >
      <TuneRound class="h-4 w-4 text-slate-500" />
      <span class="text-sm font-medium text-slate-700">
        {{ searchList.length > 0 || excludeList.length > 0 ? "已配置筛选" : "搜索配置" }}
      </span>
      <span
        v-if="searchList.length + excludeList.length > 0"
        class="rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white"
      >
        {{ searchList.length + excludeList.length }}
      </span>
      <KeyboardArrowDownRound
        class="h-4 w-4 text-slate-400 transition-transform duration-200"
        :class="{ 'rotate-180': isOpen }"
      />
    </div>

    <!-- 搜索面板下拉 -->
    <Transition name="dropdown">
      <div
        v-if="isOpen"
        class="absolute top-full right-0 z-50 mt-2 w-[400px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
      >
        <!-- 头部 -->
        <div class="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3">
          <span class="text-[11px] font-bold tracking-wider text-slate-400 uppercase">搜索配置</span>
          <button @click.stop="$emit('toggle')" class="text-slate-400 hover:text-slate-600">
            <CloseRound class="h-4 w-4" />
          </button>
        </div>

        <LogSearchForm
          :search-list="searchList"
          :exclude-list="excludeList"
          :search-input="searchInput"
          :exclude-input="excludeInput"
          @add-search="$emit('add-search')"
          @remove-search="$emit('remove-search', $event)"
          @add-exclude="$emit('add-exclude')"
          @remove-exclude="$emit('remove-exclude', $event)"
          @update:search-input="$emit('update:searchInput', $event)"
          @update:exclude-input="$emit('update:excludeInput', $event)"
          @apply="$emit('apply')"
        >
          <template #above-apply>
            <label class="mb-2 block text-[11px] font-bold tracking-wider text-slate-400 uppercase">日志级别</label>
            <LogLevelFilter :active-level-filters="activeLevelFilters" @toggle="$emit('toggle-level', $event)" />
          </template>
        </LogSearchForm>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { KeyboardArrowDownRound, TuneRound, CloseRound } from "@vicons/material";
import LogSearchForm from "./LogSearchForm.vue";
import LogLevelFilter from "./LogLevelFilter.vue";
import type { LogLevel } from "../types";

defineProps<{
  isOpen: boolean;
  searchList: string[];
  excludeList: string[];
  searchInput: string;
  excludeInput: string;
  activeLevelFilters: LogLevel[];
}>();

defineEmits<{
  toggle: [];
  "add-search": [];
  "remove-search": [index: number];
  "add-exclude": [];
  "remove-exclude": [index: number];
  "update:searchInput": [value: string];
  "update:excludeInput": [value: string];
  apply: [];
  "toggle-level": [level: LogLevel];
}>();
</script>
