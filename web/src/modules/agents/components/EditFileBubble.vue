<template>
  <div class="font-sans w-full rounded-lg overflow-hidden border border-zinc-200 bg-white shadow-sm text-[11px]">
    <!-- Header -->
    <div
      class="group flex items-center gap-2 px-3 py-1.5 bg-zinc-50/50 hover:bg-zinc-100/50 transition-colors cursor-pointer select-none"
      @click="collapsed = !collapsed"
    >
      <!-- Icon Container (Switches between file icon and chevron on hover) -->
      <div class="w-4 h-4 shrink-0 flex items-center justify-center relative">
        <!-- Spinner (loading) -->
        <AutorenewOutlined v-if="isStreaming" class="size-4 text-blue-500 animate-spin" />
        
        <template v-else>
          <!-- Chevron (visible on hover) -->
          <div
            v-if="hasDiff"
            class="absolute opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center justify-center"
          >
            <KeyboardArrowDownOutlined 
              class="size-4 text-zinc-400 transition-transform duration-200"
              :class="collapsed ? '-rotate-90' : ''"
            />
          </div>
          <!-- File Icon (hidden on hover) -->
          <div class="flex items-center group-hover:opacity-0 transition-opacity duration-200">
            <component :is="fileIconComponent" class="size-4 text-blue-500" />
          </div>
        </template>
      </div>

      <span class="text-zinc-500 font-medium truncate flex-1">{{ filename }}</span>

      <!-- Badges -->
      <div class="flex items-center gap-3 shrink-0">
        <span v-if="!isStreaming && (diffStats.added || diffStats.removed)" class="text-[10px] font-mono flex items-center gap-1.5">
          <span v-if="diffStats.added" class="text-emerald-600">+{{ diffStats.added }}</span>
          <span v-if="diffStats.removed" class="text-rose-500">-{{ diffStats.removed }}</span>
        </span>
      </div>
    </div>

    <!-- Diff body -->
    <div v-if="!isStreaming && !collapsed && hasDiff" class="border-t border-zinc-100 diff-container" :class="{ 'hide-indicators': !showIndicators }">
      <DiffView
        :data="diffData"
        :diff-view-mode="DiffModeEnum.Unified"
        :diff-view-highlight="true"
        :diff-view-font-size="10"
      />
    </div>
  </div>
</template>

<style scoped>
:deep(.git-diff-view) {
  --diff-selection-bg: rgba(59, 130, 246, 0.1);
  border: none !important;
  border-radius: 0 !important;
}

:deep(.diff-line-num) {
  display: none !important;
}

:deep(.diff-line-content) {
  padding-left: 1rem !important;
}

:deep(.hide-indicators .diff-line-content::before),
:deep(.hide-indicators .diff-line-prefix),
:deep(.hide-indicators .diff-line-marker),
:deep(.hide-indicators .diff-line-content-operator),
:deep(.hide-indicators [data-operator]) {
  display: none !important;
}

:deep(.hide-indicators .diff-line-content-item) {
  padding-left: 0 !important;
}

:deep(.diff-line-add) {
  background-color: rgba(16, 185, 129, 0.1) !important;
}

:deep(.diff-line-del) {
  background-color: rgba(244, 63, 94, 0.1) !important;
}

:deep(.diff-hunk-header) {
  display: none !important;
}
</style>

<script setup lang="ts">
import type { ToolCallWithResult } from "@langchain/vue";
import { DiffModeEnum, DiffView } from "@git-diff-view/vue";
import "@git-diff-view/vue/styles/diff-view-pure.css";
import { computed, ref, watch } from "vue";
import { 
  DescriptionOutlined, 
  KeyboardArrowDownOutlined, 
  AutorenewOutlined,
  ImageOutlined,
  CodeOutlined,
  ArticleOutlined
} from "@vicons/material";

const props = withDefaults(defineProps<{ 
  toolCall: ToolCallWithResult;
  showIndicators?: boolean;
}>(), {
  showIndicators: false
});

const collapsed = ref(true);

const args = computed(() => props.toolCall?.call?.args ?? {});
const toolName = computed(() => props.toolCall?.call?.name ?? "");
const isWriteFile = computed(() => toolName.value === "write_file");
const filename = computed(() => (args.value.path as string) || "");
const isStreaming = computed(() => !props.toolCall?.result);

const oldStr = computed(() => isWriteFile.value ? "" : ((args.value.old_string as string) ?? ""));
const newStr = computed(() => isWriteFile.value ? ((args.value.content as string) ?? "") : ((args.value.new_string as string) ?? ""));

const hasDiff = computed(() => !!(oldStr.value || newStr.value));

const diffStats = computed(() => ({
  added: newStr.value ? newStr.value.split("\n").length : 0,
  removed: oldStr.value ? oldStr.value.split("\n").length : 0,
}));

function buildDiff(fileName: string, old: string, nw: string): string {
  const oldLines = old ? old.split("\n") : [];
  const newLines = nw ? nw.split("\n") : [];
  const hunkHeader = `@@ -1,${Math.max(oldLines.length, 1)} +1,${Math.max(newLines.length, 1)} @@`;
  const body = [...oldLines.map(l => `-${l}`), ...newLines.map(l => `+${l}`)].join("\n");
  return `--- a/${fileName}\n+++ b/${fileName}\n${hunkHeader}\n${body}`;
}

const diffData = computed(() => {
  const ext = filename.value.split(".").pop()?.toLowerCase() ?? "";
  return {
    oldFile: { fileName: filename.value, fileLang: ext, content: oldStr.value },
    newFile: { fileName: filename.value, fileLang: ext, content: newStr.value },
    hunks: hasDiff.value ? [buildDiff(filename.value, oldStr.value, newStr.value)] : [],
  };
});

watch(isStreaming, (streaming) => {
  if (!streaming && hasDiff.value) collapsed.value = false;
});

function getFileIconComponent(filePath: string) {
  if (!filePath) return DescriptionOutlined;
  const name = filePath.split(/[/\\]/).pop() || "";
  const dot = name.lastIndexOf(".");
  if (dot < 0) return DescriptionOutlined;
  
  const ext = name.slice(dot + 1).toLowerCase();
  const imageExts = ["png", "jpg", "jpeg", "gif", "webp", "ico", "bmp", "svg"];
  const codeExts = ["js", "ts", "vue", "jsx", "tsx", "py", "go", "rs", "sh", "bat", "sql", "json", "html", "css"];
  const docExts = ["md", "mdx", "txt", "pdf"];

  if (imageExts.includes(ext)) return ImageOutlined;
  if (codeExts.includes(ext)) return CodeOutlined;
  if (docExts.includes(ext)) return ArticleOutlined;
  
  return DescriptionOutlined;
}

const fileIconComponent = computed(() => getFileIconComponent(filename.value));
</script>
