<template>
  <div v-if="visible" class="fixed inset-0 z-[60] flex items-center justify-center p-4">
    <div class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" @click="$emit('close')" />
    <div class="form-card relative w-full max-w-lg overflow-hidden rounded-2xl shadow-2xl">
      <div class="flex items-center justify-between border-b border-gray-100 px-8 py-5">
        <div class="flex items-center gap-3">
          <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
            <VpnKeyFilled class="h-4 w-4" />
          </div>
          <h3 class="font-bold text-gray-800">添加认证配置</h3>
        </div>
        <button
          class="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          @click="$emit('close')"
        >
          <CloseFilled class="h-4 w-4" />
        </button>
      </div>
      <div class="space-y-4 p-8">
        <div class="form-field">
          <div class="mb-3 flex items-center justify-between">
            <label class="form-group-label"> <CloudFilled class="field-icon inline h-4 w-4" />平台 </label>
          </div>
          <CustomSelect
            :model-value="form.platformId as string | number"
            @update:model-value="form.platformId = $event as string | null"
            :options="platforms.map((p) => ({ label: p.name, value: p.id }))"
            placeholder="选择平台"
          />
        </div>
        <div class="form-field">
          <div class="mb-3 flex items-center justify-between">
            <label class="form-group-label"> <LabelFilled class="field-icon inline h-4 w-4" />配置名称 </label>
            <span class="form-group-hint">便于识别</span>
          </div>
          <input v-model="form.title" type="text" placeholder="例如：生产环境API Key" class="input-modern" />
        </div>
        <div class="form-field">
          <div class="mb-3 flex items-center justify-between">
            <label class="form-group-label">
              <VpnKeyFilled class="field-icon inline h-4 w-4" />
              <span class="mr-1 text-red-500">*</span>API Key
            </label>
          </div>
          <input v-model="form.apiKey" type="password" placeholder="输入您的 API Key" class="input-modern" />
        </div>
        <div class="form-field">
          <div class="mb-3 flex items-center justify-between">
            <label class="form-group-label"> <LinkFilled class="field-icon inline h-4 w-4" />API 基础 URL </label>
            <span class="form-group-hint">可选</span>
          </div>
          <div class="flex gap-2">
            <input v-model="form.baseUrl" type="text" placeholder="https://yunwu.ai/v1" class="input-modern flex-1" />
            <button
              class="flex shrink-0 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
              :disabled="!form.apiKey.trim() || modelsLoading"
              @click="handleFetchModels"
            >
              <ListFilled v-if="!modelsLoading" class="h-3.5 w-3.5" />
              <span v-if="modelsLoading" class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
              {{ modelsLoading ? '获取中' : '获取模型' }}
            </button>
          </div>
        </div>
        <div v-if="modelList.length || form.models.length || modelsError" class="form-field">
          <div class="mb-2 flex items-center justify-between">
            <label class="form-group-label">
              <ViewListFilled class="field-icon inline h-4 w-4" />对话模型列表
              <span class="ml-1 text-xs text-gray-400">({{ form.models.length }} 个{{ modelList.length ? `，共 ${modelList.length} 可用` : '' }})</span>
            </label>
          </div>
          <div v-if="modelsError" class="mb-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-500">{{ modelsError }}</div>
          <ModelAutocompleteInput
            v-model="form.models"
            :suggestions="modelList"
            :placeholder="modelList.length ? '搜索或输入模型 ID，Enter 添加' : '输入模型 ID，Enter 添加'"
          />
        </div>
      </div>
      <div class="flex items-center justify-end gap-3 border-t border-gray-100 bg-gray-50 px-8 py-5">
        <button class="btn-secondary rounded-lg px-5 py-2 text-xs font-bold transition-colors" @click="$emit('close')">
          取消
        </button>
        <button class="btn-modern flex items-center gap-2 rounded-xl px-6 py-2 text-xs font-bold" @click="handleSave">
          <SaveFilled class="h-4 w-4" />
          保存配置
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from "vue";
import { VpnKeyFilled, CloseFilled, CloudFilled, LabelFilled, LinkFilled, SaveFilled, ListFilled, ViewListFilled } from "@vicons/material";
import { authProfileApi } from "@/api";
import CustomSelect from "@/components/CustomSelect.vue";
import ModelAutocompleteInput from "./ModelAutocompleteInput.vue";

interface Platform {
  id: string;
  name: string;
}

const props = defineProps<{
  visible: boolean;
  platforms: Platform[];
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "save", data: { platformId: string | null; title: string; apiKey: string; baseUrl: string; models: string[] }): void;
}>();

const modelList = ref<any[]>([]);
const modelsLoading = ref(false);
const modelsError = ref("");

const handleFetchModels = async () => {
  if (!form.apiKey.trim()) return;
  modelsLoading.value = true;
  modelsError.value = "";
  modelList.value = [];
  try {
    const res = (await authProfileApi.fetchModels({
      platformId: form.platformId || "",
      authStrategyId: "api-key",
      credentials: {
        apiKey: form.apiKey.trim(),
        baseUrl: form.baseUrl.trim() || undefined,
      },
    })) as { data?: any[] };
    modelList.value = res?.data ?? [];
  } catch (e: any) {
    modelsError.value = e.message || "获取模型列表失败";
  } finally {
    modelsLoading.value = false;
  }
};

const form = reactive({
  platformId: null as string | null,
  title: "",
  apiKey: "",
  baseUrl: "",
  models: [] as string[],
});

watch(
  () => props.visible,
  (newVal) => {
    if (newVal) {
      form.platformId = props.platforms[0]?.id || null;
      form.title = "";
      form.apiKey = "";
      form.baseUrl = "";
      form.models = [];
      modelList.value = [];
      modelsError.value = "";
    }
  },
);

const handleSave = () => {
  if (!form.apiKey.trim()) {
    alert("请输入 API Key");
    return;
  }
  emit("save", { ...form, models: [...form.models] });
};
</script>
