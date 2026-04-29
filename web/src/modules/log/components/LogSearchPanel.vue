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

        <div class="max-h-[60vh] space-y-4 overflow-y-auto p-4">
          <!-- 包含关键词 -->
          <div>
            <label class="mb-2 block text-[11px] font-bold tracking-wider text-slate-400 uppercase">包含任意</label>
            <div class="mb-2 flex flex-wrap gap-1.5">
              <span
                v-for="(term, idx) in searchList"
                :key="term"
                class="inline-flex items-center gap-1 rounded-md border border-blue-100 bg-blue-50 px-2 py-1 text-xs text-blue-700"
              >
                {{ term }}
                <button @click.stop="$emit('remove-search', idx)" class="hover:text-blue-900">
                  <CloseRound class="h-3.5 w-3.5" />
                </button>
              </span>
            </div>
            <div class="group relative">
              <div
                class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-blue-500"
              >
                <SearchRound class="h-4 w-4" />
              </div>
              <input
                :value="searchInput"
                @input="$emit('update:searchInput', ($event.target as HTMLInputElement).value)"
                @keyup.enter="$emit('add-search')"
                placeholder="添加搜索词..."
                class="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pr-10 pl-9 text-sm transition-all focus:border-blue-500 focus:bg-white focus:outline-none"
              />
              <button
                @click.stop="$emit('add-search')"
                class="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
              >
                <AddRound class="h-4 w-4" />
              </button>
            </div>
          </div>

          <!-- 排除关键词 -->
          <div>
            <label class="mb-2 block text-[11px] font-bold tracking-wider text-slate-400 uppercase">排除任意</label>
            <div class="mb-2 flex flex-wrap gap-1.5">
              <span
                v-for="(term, idx) in excludeList"
                :key="term"
                class="inline-flex items-center gap-1 rounded-md border border-red-100 bg-red-50 px-2 py-1 text-xs text-red-700"
              >
                {{ term }}
                <button @click.stop="$emit('remove-exclude', idx)" class="hover:text-red-900">
                  <CloseRound class="h-3.5 w-3.5" />
                </button>
              </span>
            </div>
            <div class="group relative">
              <div
                class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-red-500"
              >
                <BlockRound class="h-4 w-4" />
              </div>
              <input
                :value="excludeInput"
                @input="$emit('update:excludeInput', ($event.target as HTMLInputElement).value)"
                @keyup.enter="$emit('add-exclude')"
                placeholder="添加排除词..."
                class="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pr-10 pl-9 text-sm transition-all focus:border-red-500 focus:bg-white focus:outline-none"
              />
              <button
                @click.stop="$emit('add-exclude')"
                class="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
              >
                <AddRound class="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <!-- 底部操作 -->
        <div class="flex justify-end border-t border-slate-100 bg-slate-50 px-4 py-3">
          <button
            @click.stop="$emit('apply')"
            class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            应用搜索
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { KeyboardArrowDownRound, TuneRound, CloseRound, SearchRound, AddRound, BlockRound } from "@vicons/material";

defineProps<{
  isOpen: boolean;
  searchList: string[];
  excludeList: string[];
  searchInput: string;
  excludeInput: string;
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
}>();
</script>
