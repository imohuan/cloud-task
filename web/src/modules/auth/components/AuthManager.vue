<template>
  <div class="mx-auto max-w-7xl space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl font-bold text-slate-800">认证管理</h2>
        <p class="mt-1 text-xs text-slate-500">管理 API 访问所需的认证配置</p>
      </div>
      <div class="flex gap-2">
        <button
          :disabled="loading"
          class="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          @click="$emit('refresh')"
        >
          <RefreshFilled class="mr-2 inline h-2.5 w-2.5" :class="{ 'animate-spin': loading }" />
          {{ loading ? "加载中..." : "刷新列表" }}
        </button>
      </div>
    </div>

    <div class="flex flex-col gap-4 lg:flex-row lg:gap-6">
      <div class="w-full space-y-4 lg:w-1/2">
        <div class="grid grid-cols-3 gap-3">
          <div class="card-compact rounded-xl bg-white p-3">
            <p class="mb-1 text-[10px] font-bold tracking-wider text-slate-400 uppercase">总配置数</p>
            <p class="text-xl font-bold text-slate-700">{{ profiles?.length ?? 0 }}</p>
          </div>
          <div class="card-compact rounded-xl bg-white p-3">
            <p class="mb-1 text-[10px] font-bold tracking-wider text-slate-400 uppercase">平台数</p>
            <p class="text-xl font-bold text-blue-600">{{ uniquePlatformCount }}</p>
          </div>
          <div class="card-compact rounded-xl bg-white p-3">
            <p class="mb-1 text-[10px] font-bold tracking-wider text-slate-400 uppercase">活跃配置</p>
            <p class="text-xl font-bold text-emerald-600">{{ profiles?.length ?? 0 }}</p>
          </div>
        </div>

        <button
          :class="{ 'border-blue-200 bg-blue-50': isAdding }"
          class="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-white px-4 py-3 text-slate-600 transition-all hover:border-slate-300 hover:bg-slate-50"
          @click="startAdd"
        >
          <div class="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-100">
            <AddFilled class="h-3 w-3 text-blue-600" />
          </div>
          <span class="text-xs font-bold">添加新认证配置</span>
        </button>

        <div class="card-compact relative min-h-[200px] overflow-hidden rounded-2xl bg-white">
          <div class="border-b border-slate-100 bg-slate-50/50 px-4 py-3">
            <h3 class="text-[11px] font-bold tracking-wider text-slate-600 uppercase">已保存的认证配置</h3>
          </div>

          <div v-if="loading" class="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/90">
            <RefreshFilled class="mb-3 h-8 w-8 animate-spin text-blue-500" />
            <p class="text-sm text-slate-500">加载中...</p>
          </div>

          <div v-else-if="(profiles?.length ?? 0) === 0" class="py-12 text-center text-slate-300">
            <VpnKeyFilled class="mx-auto mb-2 h-8 w-8" />
            <p class="text-xs font-bold tracking-widest uppercase">暂无认证配置</p>
            <p class="mt-1 text-[10px]">点击上方按钮添加第一个配置</p>
          </div>

          <div v-else class="divide-y divide-slate-50">
            <div
              v-for="profile in profiles"
              :key="profile.id"
              :class="{
                'relative bg-blue-50/80 shadow-sm': selectedProfile?.id === profile.id,
                'hover:bg-slate-50': selectedProfile?.id !== profile.id,
              }"
              class="group cursor-pointer p-4 transition-all"
              @click="selectProfile(profile)"
            >
              <div
                v-if="selectedProfile?.id === profile.id"
                class="absolute top-0 bottom-0 left-0 w-1 rounded-r-full bg-blue-500"
              />
              <div class="flex items-start justify-between">
                <div class="flex items-center gap-3">
                  <div
                    :class="
                      selectedProfile?.id === profile.id
                        ? 'bg-blue-100 text-blue-600'
                        : 'bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-600'
                    "
                    class="flex h-9 w-9 items-center justify-center rounded-lg transition-colors"
                  >
                    <VpnKeyFilled class="h-4 w-4" />
                  </div>
                  <div>
                    <h4
                      :class="selectedProfile?.id === profile.id ? 'text-blue-700' : 'text-slate-700'"
                      class="text-xs font-bold transition-colors"
                    >
                      {{ profile.name }}
                    </h4>
                    <p
                      :class="selectedProfile?.id === profile.id ? 'text-blue-500/70' : 'text-slate-400'"
                      class="mt-0.5 text-[10px] transition-colors"
                    >
                      <CloudFilled class="mr-1 inline h-3 w-3" />{{ getPlatformName(profile.platformId) }}
                    </p>
                  </div>
                </div>
                <div class="flex items-center opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    class="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
                    title="删除"
                    @click.stop="confirmDelete(profile)"
                  >
                    <DeleteFilled class="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="w-full lg:w-1/2">
        <div
          v-if="!isAdding && !isEditing && !detailLoading"
          class="hidden h-full min-h-[300px] flex-col items-center justify-center text-slate-300 lg:flex"
        >
          <div class="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
            <SecurityFilled class="h-8 w-8 text-slate-300" />
          </div>
          <p class="text-sm font-medium">选择左侧配置进行编辑</p>
          <p class="mt-1 text-xs">或点击"添加新认证配置"创建新配置</p>
        </div>

        <div v-else-if="isAdding || isEditing" class="card-compact relative space-y-5 rounded-2xl bg-white p-6">
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
              <option v-for="platform in platforms" :key="platform.id" :value="platform.id">{{ platform.name }}</option>
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
            <input
              v-model="form.baseUrl"
              type="text"
              placeholder="https://api.example.com/v1"
              :disabled="isEditing && detailLoading"
              class="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-700 placeholder-slate-400 transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none disabled:opacity-50"
            />
          </div>

          <div class="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
            <button
              :disabled="saveLoading || (isEditing && detailLoading)"
              class="rounded-lg px-4 py-2 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              @click="cancelEdit"
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
      </div>
    </div>

    <ConfirmDialog
      v-model="deleteDialog.visible"
      :title="deleteDialog.title"
      :content="deleteDialog.content"
      :type="deleteDialog.type"
      confirm-text="删除"
      @confirm="handleDeleteConfirm"
      @cancel="handleDeleteCancel"
    />
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, computed, watch } from "vue";
import {
  RefreshFilled,
  AddFilled,
  VpnKeyFilled,
  CloudFilled,
  SecurityFilled,
  EditFilled,
  DeleteFilled,
  LabelFilled,
  LinkFilled,
  VisibilityFilled,
  VisibilityOffFilled,
  SaveFilled,
} from "@vicons/material";
import ConfirmDialog from "@/components/ConfirmDialog.vue";

interface Platform {
  id: string;
  name: string;
}

interface AuthProfile {
  id: string;
  platformId: string;
  name: string;
  apiKey?: string;
  credentials?: { apiKey?: string; baseUrl?: string };
  config?: { apiKey?: string; baseUrl?: string };
  baseUrl?: string;
}

const props = defineProps<{
  profiles?: AuthProfile[];
  platforms?: Platform[];
  loading?: boolean;
  detailLoading?: boolean;
  saveLoading?: boolean;
  currentProfile?: AuthProfile | null;
}>();

const emit = defineEmits<{
  (e: "save", data: unknown, onSuccess?: () => void): void;
  (e: "update", payload: { id: string; data: unknown }, onSuccess?: () => void): void;
  (e: "delete", id: string): void;
  (e: "refresh"): void;
  (e: "fetchDetail", id: string): void;
}>();

const isAdding = ref(false);
const isEditing = ref(false);
const selectedProfile = ref<AuthProfile | null>(null);
const showApiKey = ref(false);
const profileToDelete = ref<AuthProfile | null>(null);

const deleteDialog = reactive({
  visible: false,
  title: "删除认证配置",
  content: "",
  type: "danger" as "danger" | "warning" | "info" | "success",
});

const showDeleteDialog = (profile: AuthProfile) => {
  profileToDelete.value = profile;
  deleteDialog.title = "删除认证配置";
  deleteDialog.content = `确定要删除认证配置 "${profile.name}" 吗？此操作不可恢复。`;
  deleteDialog.type = "danger";
  deleteDialog.visible = true;
};

const handleDeleteConfirm = () => {
  if (profileToDelete.value) {
    emit("delete", profileToDelete.value.id);
    if (selectedProfile.value?.id === profileToDelete.value.id) {
      selectedProfile.value = null;
    }
    profileToDelete.value = null;
  }
  deleteDialog.visible = false;
};

const handleDeleteCancel = () => {
  profileToDelete.value = null;
  deleteDialog.visible = false;
};

watch(
  () => props.currentProfile,
  (detail) => {
    if (detail && selectedProfile.value?.id === detail.id) {
      loadProfileDetail(detail);
    }
  },
  { immediate: true },
);

const form = reactive({
  id: null as string | null,
  platformId: "",
  name: "",
  apiKey: "",
  baseUrl: "",
});

const uniquePlatformCount = computed(() => {
  const ids = (props.profiles || []).map((p) => p.platformId).filter(Boolean);
  return new Set(ids).size;
});

const isFormValid = computed(() => {
  return form.platformId && form.name.trim() && form.apiKey.trim();
});

const getPlatformName = (platformId: string) => {
  const platform = (props.platforms || []).find((p) => p.id === platformId);
  return platform?.name || "未知平台";
};

const resetForm = () => {
  form.id = null;
  form.platformId = props.platforms?.[0]?.id || "";
  form.name = "";
  form.apiKey = "";
  form.baseUrl = "";
  showApiKey.value = false;
};

const startAdd = () => {
  resetForm();
  isAdding.value = true;
  isEditing.value = false;
  selectedProfile.value = null;
};

const selectProfile = async (profile: AuthProfile) => {
  selectedProfile.value = profile;
  isEditing.value = true;
  isAdding.value = false;
  resetForm();
  emit("fetchDetail", profile.id);
};

const editProfile = (profile: AuthProfile) => {
  form.id = profile.id;
  form.platformId = profile.platformId || "";
  form.name = profile.name || "";
  form.apiKey = profile.apiKey || profile.credentials?.apiKey || profile.config?.apiKey || "";
  form.baseUrl = profile.baseUrl || profile.credentials?.baseUrl || profile.config?.baseUrl || "";
  isEditing.value = true;
  isAdding.value = false;
  selectedProfile.value = profile;
};

const loadProfileDetail = (detail: AuthProfile) => {
  if (!detail) return;
  editProfile(detail);
};

const cancelEdit = () => {
  isAdding.value = false;
  isEditing.value = false;
  selectedProfile.value = null;
  resetForm();
};

const handleSave = async () => {
  if (!isFormValid.value || props.saveLoading) return;

  const credentials: { apiKey: string; baseUrl?: string } = {
    apiKey: form.apiKey.trim(),
  };
  const baseUrl = form.baseUrl.trim();
  if (baseUrl) {
    credentials.baseUrl = baseUrl;
  }

  const data = {
    platformId: form.platformId,
    authStrategyId: "api-key",
    name: form.name.trim(),
    credentials,
  };

  const onSuccess = () => {
    cancelEdit();
  };

  if (isEditing.value && form.id) {
    emit(
      "update",
      {
        id: form.id,
        data: {
          platformId: form.platformId,
          name: data.name,
          credentials,
          enabled: true,
        },
      },
      onSuccess,
    );
  } else {
    emit("save", data, onSuccess);
  }
};

const confirmDelete = (profile: AuthProfile) => {
  showDeleteDialog(profile);
};
</script>
