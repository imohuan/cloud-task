<template>
  <div class="form-field">
    <div class="field-label">
      <NumbersFilled v-if="field.type === 'number'" class="h-3 w-3" />
      <FormatAlignLeftFilled v-else-if="field.uiHint === 'textarea'" class="h-3 w-3" />
      <CollectionsFilled v-else-if="field.uiHint === 'image-list'" class="h-3 w-3" />
      <ListFilled v-else-if="field.enumValues" class="h-3 w-3" />
      <TextFieldsFilled v-else class="h-3 w-3" />
      <span>{{ getFieldLabel(field) }}</span>
      <span v-if="!field.required" class="form-group-hint" style="margin-left: auto">可选</span>
    </div>

    <textarea
      v-if="field.uiHint === 'textarea'"
      :value="formData[getFieldKey(field)] as string"
      @input="formData[getFieldKey(field)] = ($event.target as HTMLTextAreaElement).value"
      rows="2"
      class="input-compact-sm min-h-32 resize-y"
      :required="field.required"
      :placeholder="field.placeholder || '请输入' + getFieldLabel(field)"
    />

    <div v-else-if="field.uiHint === 'image-list'">
      <div class="flex flex-wrap gap-2">
        <div
          v-for="(img, idx) in formData[getFieldKey(field)] || []"
          :key="'img-' + idx"
          class="group image-preview-item relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-50"
        >
          <LazyImage
            :src="img"
            :preview-list="(formData[getFieldKey(field)] || []) as string[]"
            :preview-index="idx"
            object-fit="cover"
            loading-text="加载中"
            error-text="加载失败"
            retry-text="点击重试"
          />
          <button
            class="absolute top-0.5 right-0.5 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[8px] text-white opacity-0 transition-colors group-hover:opacity-100 hover:bg-red-600"
            @click.prevent="$emit('remove-image', getFieldKey(field), idx)"
          >
            <CloseFilled class="h-3 w-3" />
          </button>
        </div>
        <div
          v-for="task in (uploadingMap![getFieldKey(field)] || []).filter((t) => t.status !== 'success')"
          :key="task.id"
          class="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-50"
        >
          <img :src="task.preview" class="h-full w-full object-cover" />
          <div
            v-if="task.status === 'uploading'"
            class="absolute inset-0 flex flex-col items-center justify-center bg-black/40"
          >
            <RefreshFilled class="h-5 w-5 animate-spin text-white" />
            <span class="mt-1 text-[9px] text-white">上传中</span>
          </div>
          <div
            v-else-if="task.status === 'error'"
            class="absolute inset-0 flex flex-col items-center justify-center bg-black/60"
          >
            <ErrorFilled class="h-5 w-5 text-red-400" />
            <span class="mt-0.5 w-full truncate px-1 text-center text-[8px] text-white">{{
              task.error || "上传失败"
            }}</span>
            <div class="mt-1 flex gap-1">
              <button
                class="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-[8px] text-white hover:bg-blue-600"
                title="重试"
                @click.prevent="$emit('retry-upload', getFieldKey(field), task.id)"
              >
                <ReplayFilled class="h-3 w-3" />
              </button>
              <button
                class="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[8px] text-white hover:bg-red-600"
                title="删除"
                @click.prevent="$emit('remove-upload-task', getFieldKey(field), task.id)"
              >
                <CloseFilled class="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>
        <div class="relative flex-shrink-0">
          <input
            type="file"
            :ref="(el) => $emit('set-file-ref', el as HTMLInputElement, getFieldKey(field))"
            accept="image/*"
            multiple
            class="hidden"
            @change="$emit('upload-file', $event, getFieldKey(field))"
          />
          <button
            class="flex h-24 w-24 flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 text-gray-400 transition-all hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600"
            @click.prevent="$emit('trigger-file', getFieldKey(field))"
          >
            <AddFilled class="h-5 w-5" />
            <span class="mt-0.5 text-[9px]">添加图片</span>
          </button>
        </div>
      </div>
    </div>

    <CustomSelect
      v-else-if="field.enumValues && field.enumValues.length > 0"
      :model-value="formData[getFieldKey(field)] as string | number"
      @update:model-value="formData[getFieldKey(field)] = $event"
      :options="getEnumOptions(field)"
      :placeholder="'选择' + getFieldLabel(field)"
    />

    <div
      v-else-if="field.type === 'number'"
      class="group flex items-center rounded-lg border border-gray-200 bg-white p-1 transition-all focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100"
    >
      <button
        class="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-all hover:bg-gray-100 hover:text-blue-600"
        @click.prevent="$emit('decrement', getFieldKey(field))"
      >
        <RemoveFilled class="h-3 w-3" />
      </button>
      <input
        v-model.number="formData[getFieldKey(field)]"
        type="number"
        :min="field.minValue"
        :max="field.maxValue"
        class="flex-1 bg-transparent text-center text-sm font-semibold text-gray-800 outline-none"
      />
      <button
        class="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-all hover:bg-gray-100 hover:text-blue-600"
        @click.prevent="$emit('increment', getFieldKey(field))"
      >
        <AddFilled class="h-3 w-3" />
      </button>
    </div>

    <input
      v-else
      v-model="formData[getFieldKey(field)]"
      type="text"
      class="input-compact-sm"
      :required="field.required"
      :placeholder="field.placeholder || '请输入' + getFieldLabel(field)"
    />
  </div>
</template>

<script setup lang="ts">
import {
  NumbersFilled,
  FormatAlignLeftFilled,
  CollectionsFilled,
  ListFilled,
  TextFieldsFilled,
  CloseFilled,
  RefreshFilled,
  ErrorFilled,
  ReplayFilled,
  AddFilled,
  RemoveFilled,
} from "@vicons/material";
import CustomSelect from "@/components/CustomSelect.vue";
import LazyImage from "@/components/LazyImage.vue";

interface Field {
  name?: string;
  key?: string;
  label?: string;
  description?: string;
  type?: string;
  required?: boolean;
  uiHint?: string;
  enumValues?: Array<string | { label?: string; value: string }>;
  placeholder?: string;
  minValue?: number;
  maxValue?: number;
}

defineProps<{
  field: Field;
  formData: Record<string, unknown>;
  uploadingMap?: Record<string, Array<{ id: string; preview: string; status: string; error?: string }>>;
}>();

defineEmits<{
  (e: "set-file-ref", el: HTMLInputElement, key: string): void;
  (e: "trigger-file", key: string): void;
  (e: "upload-file", event: Event, key: string): void;
  (e: "remove-image", key: string, idx: number): void;
  (e: "retry-upload", key: string, taskId: string): void;
  (e: "remove-upload-task", key: string, taskId: string): void;
  (e: "increment", key: string): void;
  (e: "decrement", key: string): void;
}>();

const getFieldKey = (field: Field) => field?.name || field?.key || "";

const getFieldLabel = (field: Field) => field?.label || field?.description || field?.name || field?.key || "未命名字段";

const getEnumOptions = (field: Field) => {
  if (!field.enumValues || !Array.isArray(field.enumValues)) return [];
  return field.enumValues.map((item) => {
    if (typeof item === "string") {
      return { label: item, value: item };
    }
    return { label: item.label || item.value, value: item.value };
  });
};
</script>
