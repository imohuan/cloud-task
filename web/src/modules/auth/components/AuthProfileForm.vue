<template>
  <div class="card-compact relative space-y-5 rounded-2xl bg-white p-6">
    <div
      v-if="isEditing && detailLoading"
      class="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-2xl bg-white/80 backdrop-blur-sm"
    >
      <RefreshFilled class="mb-3 h-8 w-8 animate-spin text-blue-500" />
      <p class="text-sm font-medium text-slate-600">加载配置中...</p>
    </div>

    <div class="flex items-center gap-3 border-b border-slate-100 pb-4">
      <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
        <component :is="isEditing ? EditFilled : AddFilled" class="h-5 w-5" />
      </div>
      <div>
        <h3 class="font-bold text-slate-800">{{ isEditing ? "编辑认证配置" : "添加认证配置" }}</h3>
        <p class="text-[10px] text-slate-400">{{ isEditing ? "修改现有认证信息" : "创建新的 API 访问凭证" }}</p>
      </div>
    </div>

    <div class="space-y-2">
      <label class="text-[11px] font-bold tracking-wider text-slate-600 uppercase">
        <CloudFilled class="mr-1 inline h-3 w-3 text-slate-400" />平台
      </label>
      <select
        v-model="form.platformId"
        :disabled="isEditing && detailLoading"
        class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-700 transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none disabled:opacity-50"
      >
        <option value="">选择平台</option>
        <option v-for="p in platforms" :key="p.id" :value="p.id">{{ p.name }}</option>
      </select>
    </div>

    <div class="space-y-2">
      <label class="text-[11px] font-bold tracking-wider text-slate-600 uppercase">
        <LabelFilled class="mr-1 inline h-3 w-3 text-slate-400" />配置名称
      </label>
      <input
        v-model="form.name"
        type="text"
        placeholder="例如：生产环境 API Key"
        :disabled="isEditing && detailLoading"
        class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-700 placeholder-slate-400 transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none disabled:opacity-50"
      />
    </div>

    <div class="space-y-2">
      <label class="text-[11px] font-bold tracking-wider text-slate-600 uppercase">
        <VpnKeyFilled class="mr-1 inline h-3 w-3 text-slate-400" />
        <span class="text-red-500">*</span> API Key
      </label>
      <div class="relative">
        <input
          v-model="form.apiKey"
          :type="showApiKey ? 'text' : 'password'"
          placeholder="输入您的 API Key"
          :disabled="isEditing && detailLoading"
          class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 pr-10 text-xs text-slate-700 placeholder-slate-400 transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none disabled:opacity-50"
        />
        <button
          type="button"
          class="absolute top-1/2 right-3 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          @click="showApiKey = !showApiKey"
        >
          <component :is="showApiKey ? VisibilityOffFilled : VisibilityFilled" class="h-4 w-4" />
        </button>
      </div>
    </div>

    <div class="space-y-2">
      <label class="text-[11px] font-bold tracking-wider text-slate-600 uppercase">
        <LinkFilled class="mr-1 inline h-3 w-3 text-slate-400" />API 基础 URL
        <span class="ml-1 text-[10px] font-normal text-slate-400 normal-case">(可选)</span>
      </label>
      <div class="flex gap-2">
        <input
          v-model="form.baseUrl"
          type="text"
          placeholder="https://api.example.com/v1"
          :disabled="isEditing && detailLoading"
          class="w-full flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-700 placeholder-slate-400 transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none disabled:opacity-50"
        />
        <button
          type="button"
          :disabled="!form.apiKey.trim() || modelsLoading || (isEditing && detailLoading)"
          class="flex shrink-0 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
          @click="handleFetchModels"
        >
          <span v-if="modelsLoading" class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
          <ListFilled v-else class="h-3.5 w-3.5" />
          {{ modelsLoading ? '获取中' : '获取模型' }}
        </button>
      </div>
      <p v-if="modelsError" class="text-[11px] text-red-500">{{ modelsError }}</p>
    </div>

    <div class="space-y-2">
      <label class="text-[11px] font-bold tracking-wider text-slate-600 uppercase">
        <ViewListFilled class="mr-1 inline h-3 w-3 text-slate-400" />对话模型列表
        <span class="ml-1 text-[10px] font-normal text-slate-400 normal-case">
          ({{ form.models.length }} 个{{ modelList.length ? `，共 ${modelList.length} 可用` : '' }})
        </span>
      </label>
      <ModelAutocompleteInput
        v-model="form.models"
        :suggestions="modelList"
        :placeholder="modelList.length ? '搜索或输入模型 ID，Enter 添加' : '输入模型 ID，Enter 添加'"
      />
    </div>

    <div class="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
      <button
        :disabled="saveLoading || (isEditing && detailLoading)"
        class="rounded-lg px-4 py-2 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
        @click="$emit('cancel')"
      >
        取消
      </button>
      <button
        :disabled="!isFormValid || saveLoading || (isEditing && detailLoading)"
        class="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-xs font-bold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        @click="handleSave"
      >
        <RefreshFilled v-if="saveLoading" class="h-3 w-3 animate-spin" />
        <component :is="isEditing ? SaveFilled : AddFilled" v-else class="h-3 w-3" />
        {{ saveLoading ? "保存中..." : isEditing ? "保存修改" : "创建配置" }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, computed, watch } from "vue";
import {
  RefreshFilled,
  AddFilled,
  EditFilled,
  SaveFilled,
  VpnKeyFilled,
  CloudFilled,
  LabelFilled,
  LinkFilled,
  ListFilled,
  ViewListFilled,
  VisibilityFilled,
  VisibilityOffFilled,
} from "@vicons/material";
import { authProfileApi } from "@/api";
import ModelAutocompleteInput from "./ModelAutocompleteInput.vue";

interface Platform {
  id: string;
  name: string;
}

interface AuthProfile {
  id: string;
  platformId: string;
  name: string;
  apiKey?: string;
  credentials?: { apiKey?: string; baseUrl?: string; models?: string[] };
  config?: { apiKey?: string; baseUrl?: string };
  baseUrl?: string;
}

const props = defineProps<{
  isAdding: boolean;
  isEditing: boolean;
  detailLoading?: boolean;
  saveLoading?: boolean;
  platforms?: Platform[];
  currentProfile?: AuthProfile | null;
}>();

const emit = defineEmits<{
  (e: "save", data: unknown): void;
  (e: "cancel"): void;
}>();

const showApiKey = ref(false);
const modelList = ref<any[]>([]);
const modelsLoading = ref(false);
const modelsError = ref("");

const form = reactive({
  id: null as string | null,
  platformId: "",
  name: "",
  apiKey: "",
  baseUrl: "",
  models: [] as string[],
});

const isFormValid = computed(() => form.platformId && form.name.trim() && form.apiKey.trim());

const resetForm = () => {
  form.id = null;
  form.platformId = props.platforms?.[0]?.id || "";
  form.name = "";
  form.apiKey = "";
  form.baseUrl = "";
  form.models = [];
  showApiKey.value = false;
  modelList.value = [];
  modelsError.value = "";
};

const loadFromProfile = (profile: AuthProfile) => {
  form.id = profile.id;
  form.platformId = profile.platformId || "";
  form.name = profile.name || "";
  form.apiKey = profile.apiKey || profile.credentials?.apiKey || profile.config?.apiKey || "";
  form.baseUrl = profile.baseUrl || profile.credentials?.baseUrl || profile.config?.baseUrl || "";
  form.models = profile.credentials?.models || [];
  modelList.value = [];
  modelsError.value = "";
};

watch(
  () => props.isAdding,
  (val) => { if (val) resetForm(); },
  { immediate: true },
);

watch(
  () => props.currentProfile,
  (profile) => {
    if (profile && props.isEditing) loadFromProfile(profile);
  },
  { immediate: true },
);

const handleFetchModels = async () => {
  if (!form.apiKey.trim()) return;
  modelsLoading.value = true;
  modelsError.value = "";
  modelList.value = [];
  try {
    const res = (await authProfileApi.fetchModels({
      platformId: form.platformId,
      authStrategyId: "api-key",
      credentials: {
        apiKey: form.apiKey.trim(),
        ...(form.baseUrl.trim() ? { baseUrl: form.baseUrl.trim() } : {}),
      },
    })) as { data?: any[] };
    modelList.value = res?.data ?? [];
  } catch (e: any) {
    modelsError.value = e.message || "获取模型列表失败";
  } finally {
    modelsLoading.value = false;
  }
};

const handleSave = () => {
  if (!isFormValid.value || props.saveLoading) return;
  const credentials: Record<string, any> = { apiKey: form.apiKey.trim() };
  if (form.baseUrl.trim()) credentials.baseUrl = form.baseUrl.trim();
  if (form.models.length) credentials.models = [...form.models];

  emit("save", {
    id: form.id,
    platformId: form.platformId,
    authStrategyId: "api-key",
    name: form.name.trim(),
    credentials,
  });
};
</script>
