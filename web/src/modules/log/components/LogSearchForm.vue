<template>
  <!-- Compact (mobile inline) mode -->
  <template v-if="compact">
    <div class="space-y-2 pt-2">
      <!-- 包含关键词 -->
      <div>
        <label class="mb-1 block text-[11px] font-bold tracking-wider text-slate-400 uppercase">包含任意</label>
        <div v-if="searchList.length" class="mb-1 flex flex-wrap gap-1">
          <span
            v-for="(term, idx) in searchList"
            :key="term"
            class="inline-flex items-center gap-1 rounded-md border border-blue-100 bg-blue-50 px-2 py-0.5 text-xs text-blue-700"
          >
            {{ term }}
            <button @click.stop="$emit('remove-search', idx)" class="hover:text-blue-900">
              <CloseRound class="h-3 w-3" />
            </button>
          </span>
        </div>
        <div class="group relative">
          <div class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-blue-500">
            <SearchRound class="h-4 w-4" />
          </div>
          <input
            :value="searchInput"
            @input="$emit('update:searchInput', ($event.target as HTMLInputElement).value)"
            @keyup.enter="$emit('add-search')"
            placeholder="包含关键词..."
            class="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pr-10 pl-9 text-sm transition-all focus:border-blue-500 focus:bg-white focus:outline-none"
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
        <label class="mb-1 block text-[11px] font-bold tracking-wider text-slate-400 uppercase">排除任意</label>
        <div v-if="excludeList.length" class="mb-1 flex flex-wrap gap-1">
          <span
            v-for="(term, idx) in excludeList"
            :key="term"
            class="inline-flex items-center gap-1 rounded-md border border-red-100 bg-red-50 px-2 py-0.5 text-xs text-red-700"
          >
            {{ term }}
            <button @click.stop="$emit('remove-exclude', idx)" class="hover:text-red-900">
              <CloseRound class="h-3 w-3" />
            </button>
          </span>
        </div>
        <div class="group relative">
          <div class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-red-500">
            <BlockRound class="h-4 w-4" />
          </div>
          <input
            :value="excludeInput"
            @input="$emit('update:excludeInput', ($event.target as HTMLInputElement).value)"
            @keyup.enter="$emit('add-exclude')"
            placeholder="排除关键词..."
            class="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pr-10 pl-9 text-sm transition-all focus:border-red-500 focus:bg-white focus:outline-none"
          />
          <button
            @click.stop="$emit('add-exclude')"
            class="absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
          >
            <AddRound class="h-4 w-4" />
          </button>
        </div>
      </div>
      <!-- 应用前插槽（可注入级别筛选等） -->
      <slot name="above-apply" />
      <!-- 应用 -->
      <div class="flex gap-2">
        <button
          @click.stop="$emit('apply')"
          class="flex-1 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          应用
        </button>
        <slot name="apply-extra" />
      </div>
    </div>
  </template>

  <!-- Full (desktop dropdown) mode -->
  <template v-else>
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
          <div class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-blue-500">
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
          <div class="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-red-500">
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
    <!-- 应用前插槽（可注入级别筛选等） -->
    <div v-if="$slots['above-apply']" class="border-t border-slate-100 px-4 py-3">
      <slot name="above-apply" />
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
  </template>
</template>

<script setup lang="ts">
import { CloseRound, SearchRound, AddRound, BlockRound } from "@vicons/material";

withDefaults(defineProps<{
  compact?: boolean;
  searchList: string[];
  excludeList: string[];
  searchInput: string;
  excludeInput: string;
}>(), {
  compact: false,
});

defineEmits<{
  "add-search": [];
  "remove-search": [index: number];
  "add-exclude": [];
  "remove-exclude": [index: number];
  "update:searchInput": [value: string];
  "update:excludeInput": [value: string];
  apply: [];
}>();
</script>
