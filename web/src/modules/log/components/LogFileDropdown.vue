<template>
  <Dropdown placement="bottom-start" :is-open="isOpen" @update:is-open="handleUpdateIsOpen">
    <template #trigger="{ isOpen: open }">
      <div
        class="flex cursor-pointer items-center gap-1 rounded-lg border border-transparent bg-slate-50 px-3 py-1.5 transition-colors hover:border-slate-200 hover:bg-slate-50"
        :class="{ 'border-slate-200 bg-slate-50': open }"
      >
        <span class="text-sm font-semibold text-slate-900">
          {{ selectedFile ? selectedFile.name : "选择日志文件" }}
        </span>
        <KeyboardArrowDownRound
          class="h-4 w-4 text-slate-400 transition-transform duration-200"
          :class="{ 'rotate-180': open }"
        />
      </div>
    </template>

    <template #default="{ close }">
      <div class="w-80 overflow-hidden shadow-lg">
        <!-- 头部 -->
        <div class="border-b border-slate-100 bg-slate-50 px-4 py-2">
          <span class="text-[11px] font-bold tracking-wider text-slate-400 uppercase">日志文件列表</span>
        </div>

        <!-- 加载中 -->
        <div v-if="isLoading && logFiles.length === 0" class="p-6 text-center">
          <RefreshRound class="inline h-5 w-5 animate-spin text-slate-400" />
          <p class="mt-2 text-sm text-slate-400">加载中...</p>
        </div>

        <!-- 空状态 -->
        <div v-else-if="logFiles.length === 0" class="p-6 text-center text-slate-400">
          <FolderOpenRound class="mx-auto mb-2 h-8 w-8" />
          <p class="text-sm">暂无日志文件</p>
        </div>

        <!-- 文件列表 -->
        <div v-else class="max-h-80 overflow-y-auto">
          <div
            v-for="file in logFiles"
            :key="file.name"
            @click="$emit('select', file); close()"
            class="flex cursor-pointer items-center gap-3 border-l-4 px-4 py-3 transition-colors"
            :class="
              selectedFile?.name === file.name
                ? 'border-l-blue-600 bg-blue-50'
                : 'border-l-transparent hover:bg-slate-50'
            "
          >
            <DescriptionRound class="h-5 w-5 text-slate-400" />
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium text-slate-700">{{ file.name }}</p>
              <p class="text-[11px] text-slate-400">{{ formatDate(file.modifiedAt) }} · {{ file.sizeFormatted }}</p>
            </div>
            <CheckRound v-if="selectedFile?.name === file.name" class="h-4 w-4 text-blue-600" />
          </div>
        </div>

        <!-- 底部 -->
        <div
          class="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-4 py-2 text-[11px] text-slate-400"
        >
          <span>{{ logFiles.length }} 个文件</span>
          <span class="flex items-center gap-1">
            <span class="h-1.5 w-1.5 rounded-full" :class="isConnected ? 'bg-emerald-500' : 'bg-red-500'"></span>
            {{ isConnected ? "已连接" : "未连接" }}
          </span>
        </div>
      </div>
    </template>
  </Dropdown>
</template>

<script setup lang="ts">
import { KeyboardArrowDownRound, DescriptionRound, FolderOpenRound, CheckRound, RefreshRound } from "@vicons/material";
import Dropdown from "@/components/dropdown/Dropdown.vue";
import type { LogFile } from "../types";

const props = defineProps<{
  isOpen: boolean;
  selectedFile: LogFile | null;
  logFiles: LogFile[];
  isLoading: boolean;
  isConnected: boolean;
}>();

const emit = defineEmits<{
  toggle: [];
  select: [file: LogFile];
}>();

function handleUpdateIsOpen(value: boolean) {
  if (value !== props.isOpen) emit("toggle");
}

function formatDate(date: string): string {
  const d = new Date(date);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${month}-${day} ${hours}:${minutes}`;
}
</script>
