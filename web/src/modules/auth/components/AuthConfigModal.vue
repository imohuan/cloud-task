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
          <input v-model="form.baseUrl" type="text" placeholder="https://yunwu.ai/v1" class="input-modern" />
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
import { reactive, watch } from "vue";
import { VpnKeyFilled, CloseFilled, CloudFilled, LabelFilled, LinkFilled, SaveFilled } from "@vicons/material";
import CustomSelect from "@/components/CustomSelect.vue";

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
  (e: "save", data: { platformId: string | null; title: string; apiKey: string; baseUrl: string }): void;
}>();

const form = reactive({
  platformId: null as string | null,
  title: "",
  apiKey: "",
  baseUrl: "",
});

watch(
  () => props.visible,
  (newVal) => {
    if (newVal) {
      form.platformId = props.platforms[0]?.id || null;
      form.title = "";
      form.apiKey = "";
      form.baseUrl = "";
    }
  },
);

const handleSave = () => {
  if (!form.apiKey.trim()) {
    alert("请输入 API Key");
    return;
  }
  emit("save", { ...form });
};
</script>
