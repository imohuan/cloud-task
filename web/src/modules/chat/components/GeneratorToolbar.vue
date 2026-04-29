<template>
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-2">
      <TypeDropdown
        :current-type="currentType ?? undefined"
        :is-open="activeDropdown === 'type'"
        @update:is-open="toggleDropdown('type')"
        @select="(t) => emit('select-type', t)"
      />
      <template v-if="modelOptions.length > 0">
        <ConfigDropdown
          :items="modelOptions"
          :current-value="currentModelValue"
          title="模型选择"
          content-class="w-90 p-2"
          icon-html='<svg xmlns="http://www.w3.org/2000/svg" class="size-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="6" height="6" rx="1"/><path stroke-linecap="round" stroke-linejoin="round" d="M9 3H7a2 2 0 00-2 2v2M15 3h2a2 2 0 012 2v2M9 21H7a2 2 0 01-2-2v-2M15 21h2a2 2 0 002-2v-2M3 9v2M3 13v2M21 9v2M21 13v2"/></svg>'
          :is-open="activeDropdown === 'model'"
          @update:is-open="toggleDropdown('model')"
          @select="(item) => emit('select-model', item as ModelOption)"
        />
        <RatioDropdown
          v-if="showDimension"
          :ratios="ratioOptions"
          :current-ratio="currentRatio ?? undefined"
          :resolutions="resolutionOptions"
          :current-res="currentRes ?? undefined"
          :custom-width="customWidth"
          :custom-height="customHeight"
          :is-open="activeDropdown === 'ratio'"
          :show-resolution="resolutionOptions.length > 0"
          :show-size="ratioOptions.length > 0"
          :show-dimension="hasDimension"
          icon-html='<svg xmlns="http://www.w3.org/2000/svg" class="size-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/></svg>'
          @update:is-open="toggleDropdown('ratio')"
          @select-ratio="(ratio) => emit('select-ratio', ratio)"
          @select-res="(res) => emit('select-resolution', res)"
          @update-width="(v) => emit('update-width', v)"
          @update-height="(v) => emit('update-height', v)"
        />
        <ConfigDropdown
          v-for="field in customParameterFields"
          :key="field.id"
          :items="field.options"
          :current-value="fieldValues[field.id] ?? ''"
          :title="field.title"
          content-class="w-48 p-2"
          :is-open="activeDropdown === field.id"
          @update:is-open="toggleDropdown(field.id)"
          @select="(item) => emit('select-custom-field', field.id, item)"
        />
      </template>
      <button
        class="flex size-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
        @click="emit('insertQuotes')"
      >
        <span class="font-serif text-sm leading-none font-bold">A</span>
      </button>
    </div>
    <div class="flex items-center gap-4">
      <ConfigDropdown
        v-if="nOptions.length > 0"
        :items="nOptions"
        :current-value="fieldValues['n'] ?? ''"
        :label="(currentN ? currentN.id : '1') + ' / ' + (currentType?.categoryId === 'image' ? '张' : '个')"
        icon-html='<svg xmlns="http://www.w3.org/2000/svg" class="size-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7" /></svg>'
        trigger-class="flex items-center gap-1 text-sm text-gray-900"
        arrow-class="hidden"
        content-class="w-20 p-2"
        :is-open="activeDropdown === 'nCount'"
        @update:is-open="toggleDropdown('nCount')"
        @select="(item) => emit('select-n', item as NOption)"
      />
      <div v-else class="flex items-center gap-1 text-sm text-slate-700">
        <span>1 / {{ currentType?.categoryId === "image" ? "张" : "个" }}</span>
      </div>
      <button
        :disabled="disabled"
        class="flex size-10 items-center justify-center rounded-full bg-slate-900 text-white shadow-lg transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-slate-900"
        @click="emit('submit')"
      >
        <svg
          v-if="loading"
          xmlns="http://www.w3.org/2000/svg"
          class="size-5 animate-spin"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <svg
          v-else
          xmlns="http://www.w3.org/2000/svg"
          class="size-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useDropdown } from "../composables/useDropdown";
import TypeDropdown from "./TypeDropdown.vue";
import ConfigDropdown from "./ConfigDropdown.vue";
import RatioDropdown from "./RatioDropdown.vue";
import type {
  TypeItem,
  ModelOption,
  RatioOption,
  ResolutionOption,
  NOption,
  CustomField,
} from "../composables/useGeneratorConfig";

defineProps<{
  disabled?: boolean;
  loading?: boolean;
  currentType?: TypeItem | null;
  modelOptions: ModelOption[];
  currentModelValue: string;
  ratioOptions: RatioOption[];
  currentRatio: RatioOption | null;
  resolutionOptions: ResolutionOption[];
  currentRes: ResolutionOption | null;
  hasDimension: boolean;
  customWidth: number;
  customHeight: number;
  showDimension: boolean;
  nOptions: NOption[];
  currentN: NOption | null;
  customParameterFields: CustomField[];
  fieldValues: Record<string, string>;
}>();

const emit = defineEmits<{
  (e: "submit"): void;
  (e: "insertQuotes"): void;
  (e: "select-type", type: TypeItem): void;
  (e: "select-model", model: ModelOption): void;
  (e: "select-ratio", ratio: RatioOption): void;
  (e: "select-resolution", res: ResolutionOption): void;
  (e: "update-width", v: number): void;
  (e: "update-height", v: number): void;
  (e: "select-n", n: NOption): void;
  (e: "select-custom-field", fieldName: string, item: { id: string }): void;
}>();

const { activeDropdown, toggleDropdown } = useDropdown();
</script>
