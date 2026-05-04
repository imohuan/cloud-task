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
      <AuthProfileList
        :profiles="profiles"
        :platforms="platforms"
        :loading="loading"
        :is-adding="isAdding"
        :selected-profile-id="selectedProfile?.id"
        @add="startAdd"
        @select="selectProfile"
        @delete="confirmDelete"
      />

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

        <AuthProfileForm
          v-else-if="isAdding || isEditing"
          :is-adding="isAdding"
          :is-editing="isEditing"
          :detail-loading="detailLoading"
          :save-loading="saveLoading"
          :platforms="platforms"
          :current-profile="currentProfile"
          @save="handleFormSave"
          @cancel="cancelEdit"
        />
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
import { ref, reactive } from "vue";
import { RefreshFilled, SecurityFilled } from "@vicons/material";
import ConfirmDialog from "@/components/ConfirmDialog.vue";
import AuthProfileList from "./AuthProfileList.vue";
import AuthProfileForm from "./AuthProfileForm.vue";

interface AuthProfile {
  id: string;
  platformId: string;
  name: string;
  apiKey?: string;
  credentials?: { apiKey?: string; baseUrl?: string; models?: string[] };
  config?: { apiKey?: string; baseUrl?: string };
  baseUrl?: string;
}

interface Platform {
  id: string;
  name: string;
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
const profileToDelete = ref<AuthProfile | null>(null);

const deleteDialog = reactive({
  visible: false,
  title: "删除认证配置",
  content: "",
  type: "danger" as "danger" | "warning" | "info" | "success",
});

const startAdd = () => {
  isAdding.value = true;
  isEditing.value = false;
  selectedProfile.value = null;
};

const selectProfile = (profile: AuthProfile) => {
  selectedProfile.value = profile;
  isEditing.value = true;
  isAdding.value = false;
  emit("fetchDetail", profile.id);
};

const cancelEdit = () => {
  isAdding.value = false;
  isEditing.value = false;
  selectedProfile.value = null;
};

const handleFormSave = (data: any) => {
  const onSuccess = () => cancelEdit();
  if (data.id && isEditing.value) {
    emit(
      "update",
      {
        id: data.id,
        data: {
          platformId: data.platformId,
          name: data.name,
          credentials: data.credentials,
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
  profileToDelete.value = profile;
  deleteDialog.content = `确定要删除认证配置 "${profile.name}" 吗？此操作不可恢复。`;
  deleteDialog.visible = true;
};

const handleDeleteConfirm = () => {
  if (profileToDelete.value) {
    emit("delete", profileToDelete.value.id);
    if (selectedProfile.value?.id === profileToDelete.value.id) cancelEdit();
    profileToDelete.value = null;
  }
  deleteDialog.visible = false;
};

const handleDeleteCancel = () => {
  profileToDelete.value = null;
  deleteDialog.visible = false;
};
</script>
