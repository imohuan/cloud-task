<template>
  <div class="grid grid-cols-1 gap-8 lg:grid-cols-3">
    <div class="space-y-6 lg:col-span-2">
      <header class="mb-6 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div
            class="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-200"
          >
            <LayersFilled class="h-5 w-5" />
          </div>
          <div>
            <h1 class="text-xl font-bold tracking-tight text-gray-900">{{ currentApi.name }}</h1>
            <p class="text-xs font-medium text-gray-500">{{ currentPlatform?.name }} API 接口配置</p>
          </div>
        </div>
        <div
          v-if="currentApi.executionMode === 'async' || currentApi.isAsync"
          class="rounded-lg border border-amber-100 bg-amber-50 px-3 py-1.5 text-[10px] font-bold text-amber-600"
        >
          <ScheduleFilled class="mr-1 inline h-3 w-3" />异步任务
        </div>
      </header>

      <main class="form-card rounded-2xl p-5">
        <form @submit.prevent="handleSubmit">
          <section class="form-section">
            <div class="section-header">
              <div class="section-icon">
                <SecurityFilled class="h-4 w-4" />
              </div>
              <h3 class="section-title">身份认证</h3>
            </div>
            <div class="form-field">
              <div class="field-label">
                <VpnKeyFilled class="h-3 w-3" />
                <span>选择 API Key</span>
                <span class="form-group-hint required" style="margin-left: auto">必填</span>
              </div>
              <CustomSelect
                :model-value="(formData.selectedAuthId as string | number | null | undefined)"
                @update:model-value="formData.selectedAuthId = $event"
                :options="filteredAuthProfiles.map((a) => ({ label: a.name, value: a.id }))"
                placeholder="请选择 API Key"
                :required="true"
              />
            </div>
          </section>

          <section class="form-section">
            <div class="section-header">
              <div class="section-icon">
                <TuneFilled class="h-4 w-4" />
              </div>
              <h3 class="section-title">参数配置</h3>
            </div>

            <div>
              <template v-if="hasLayoutConfig">
                <div v-for="(row, rowIdx) in layoutRows" :key="rowIdx" :class="getRowClass(row)">
                  <div v-for="fieldName in row.fields" :key="fieldName" :class="getFieldWrapperClass(fieldName)">
                    <FieldRenderer
                      :field="getFieldByName(fieldName)!"
                      :form-data="formData"
                      :uploading-map="uploadingMap"
                      @set-file-ref="setFileInputRef"
                      @trigger-file="triggerFileSelect"
                      @upload-file="handleFileUpload"
                      @remove-image="removeImage"
                      @retry-upload="retryUpload"
                      @remove-upload-task="removeUploadTask"
                      @increment="increment"
                      @decrement="decrement"
                    />
                  </div>
                </div>
              </template>

              <template v-else>
                <FieldRenderer
                  v-for="field in inputFields"
                  :key="getFieldKey(field)"
                  :field="field"
                  :form-data="formData"
                  :uploading-map="uploadingMap"
                  class="form-field"
                  @set-file-ref="setFileInputRef"
                  @trigger-file="triggerFileSelect"
                  @upload-file="handleFileUpload"
                  @remove-image="removeImage"
                  @retry-upload="retryUpload"
                  @remove-upload-task="removeUploadTask"
                  @increment="increment"
                  @decrement="decrement"
                />
              </template>
            </div>
          </section>

          <div class="mt-2 flex items-center justify-between border-t border-gray-100 pt-4">
            <button
              type="button"
              class="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-500 transition-all hover:bg-gray-100 hover:text-gray-700"
              @click="handleReset"
            >
              <UndoFilled class="h-3 w-3" />
              重置
            </button>
            <button
              type="submit"
              :disabled="isSubmitting"
              class="btn-modern flex items-center gap-2 rounded-lg px-5 py-1.5 text-sm font-bold"
            >
              <RefreshFilled v-if="isSubmitting" class="h-4 w-4 animate-spin" />
              <SendFilled v-else class="h-4 w-4" />
              {{
                isSubmitting
                  ? "执行中..."
                  : currentApi.executionMode === "async" || currentApi.isAsync
                    ? "创建任务"
                    : "执行调用"
              }}
            </button>
          </div>
        </form>
      </main>
    </div>

    <div class="space-y-6">
      <div class="card-compact flex min-h-[400px] flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div class="mb-4 flex items-center justify-between">
          <h4 class="text-[10px] font-bold tracking-widest text-slate-500 uppercase">实时响应日志</h4>
          <div v-if="lastResult" class="flex items-center gap-2">
            <button
              class="flex items-center gap-1 rounded px-2 py-1 text-[10px] text-slate-500 transition-colors hover:bg-slate-100 hover:text-indigo-600"
              @click="expandResult(true)"
            >
              <OpenInFullFilled class="h-3 w-3" />展开
            </button>
            <button
              class="flex items-center gap-1 rounded px-2 py-1 text-[10px] text-slate-500 transition-colors hover:bg-slate-100 hover:text-indigo-600"
              @click="expandResult(false)"
            >
              <CloseFullscreenFilled class="h-3 w-3" />折叠
            </button>
          </div>
        </div>
        <div class="flex-1 space-y-2 overflow-auto font-mono text-[11px]">
          <div v-if="lastResult">
            <p :class="lastResult.success ? 'text-emerald-600' : 'text-red-600'" class="font-medium">
              <component :is="lastResult.success ? CheckCircleFilled : CancelFilled" class="mr-1 inline h-3 w-3" />
              >> Request Status: {{ lastResult.success ? "200 OK" : "FAILED" }}
            </p>
            <div class="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <JsonViewer
                :data="lastResult.data || {}"
                :is-last="true"
                :is-root="true"
                :expand-trigger="resultExpandState"
              />
            </div>
            <div v-if="lastResult.taskId" class="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
              <p class="mb-1 text-xs font-bold text-blue-600">Async Task ID:</p>
              <p class="font-mono text-xs break-all text-blue-700">{{ lastResult.taskId }}</p>
              <div class="mt-2 flex items-center gap-2">
                <button
                  class="text-xs font-bold text-blue-600 underline hover:text-blue-700"
                  @click="$emit('viewTasks')"
                >
                  前往任务中心追踪
                </button>
                <a
                  :href="`/logs?search=${encodeURIComponent(lastResult.taskId)}`"
                  target="_blank"
                  class="text-xs font-bold text-blue-600 underline hover:text-blue-700"
                >
                  查看执行日志
                </a>
              </div>
            </div>

            <div v-if="lastResult.taskId" class="mt-4 border-t border-slate-100 pt-4">
              <TerminalPanel :search="lastResult.taskId" :load-history="true" />
            </div>
          </div>
          <div v-else class="flex h-full items-center justify-center text-slate-400">
            <div class="text-center">
              <TerminalFilled class="mb-2 h-8 w-8 opacity-30" />
              <p class="text-xs">等待请求触发...</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, watch, computed, ref, onMounted } from "vue";
import TerminalPanel from "@/components/TerminalPanel.vue";
import {
  LayersFilled,
  ScheduleFilled,
  SecurityFilled,
  VpnKeyFilled,
  TuneFilled,
  UndoFilled,
  RefreshFilled,
  SendFilled,
  OpenInFullFilled,
  CloseFullscreenFilled,
  CheckCircleFilled,
  CancelFilled,
  TerminalFilled,
} from "@vicons/material";
import CustomSelect from "@/components/CustomSelect.vue";
import JsonViewer from "@/components/JsonViewer.vue";
import FieldRenderer from "./FieldRenderer.vue";
import { useImageUpload } from "@/composables/useImageUpload";

interface ApiItem {
  id: string;
  name: string;
  executionMode?: string;
  isAsync?: boolean;
  inputSchema?: {
    fields?: Field[];
    layout?: LayoutConfig;
  };
  inputFields?: Field[];
  parameters?: Field[];
}

interface Field {
  name?: string;
  key?: string;
  label?: string;
  description?: string;
  type?: string;
  required?: boolean;
  uiHint?: string;
  enumValues?: Array<string | { label?: string; value: string }>;
  defaultValue?: unknown;
  minValue?: number;
  maxValue?: number;
  placeholder?: string;
}

interface LayoutConfig {
  rows?: Array<{ fields: string[]; className?: string }>;
  columns?: number;
  fieldConfig?: Record<string, { className?: string; colSpan?: number }>;
}

interface AuthProfile {
  id: string;
  platformId: string;
  name: string;
}

interface Platform {
  id: string;
  name: string;
}

const props = defineProps<{
  currentApi: ApiItem;
  currentPlatform?: Platform | null;
  authProfiles?: AuthProfile[];
  isSubmitting?: boolean;
  lastResult?: { success: boolean; taskId?: string; data?: unknown; error?: string } | null;
  prefilledData?: { authProfileId?: string; input?: Record<string, unknown> } | null;
}>();

const emit = defineEmits<{
  (e: "submit", payload: { authProfileId: string | null; input: Record<string, unknown> }): void;
  (e: "reset"): void;
  (e: "viewTasks"): void;
  (e: "mounted"): void;
}>();

const formData = reactive<Record<string, unknown>>({ selectedAuthId: null as string | number | null });
const resultExpandState = ref(1);

const expandResult = (expand: boolean) => {
  resultExpandState.value = expand ? Math.abs(resultExpandState.value) + 1 : -(Math.abs(resultExpandState.value) + 1);
};

onMounted(() => {
  emit("mounted");
});

const inputFields = computed<Field[]>(() => {
  const api = props.currentApi;
  if (!api) return [];
  if (api.inputSchema?.fields && Array.isArray(api.inputSchema.fields)) {
    return api.inputSchema.fields;
  }
  if (api.inputSchema && Array.isArray(api.inputSchema)) {
    return api.inputSchema as Field[];
  }
  if (api.inputFields && Array.isArray(api.inputFields)) {
    return api.inputFields;
  }
  if (api.parameters && Array.isArray(api.parameters)) {
    return api.parameters;
  }
  return [];
});

const getFieldKey = (field: Field) => field?.name || field?.key || "";

const layoutConfig = computed(() => props.currentApi?.inputSchema?.layout);

const hasLayoutConfig = computed(() => {
  const cfg = layoutConfig.value;
  return cfg && (cfg.rows || cfg.columns);
});

const fieldMap = computed(() => {
  const map: Record<string, Field> = {};
  inputFields.value.forEach((f) => {
    const key = getFieldKey(f);
    if (key) map[key] = f;
  });
  return map;
});

const getFieldByName = (name: string) => fieldMap.value[name];

const layoutRows = computed(() => {
  const cfg = layoutConfig.value;
  if (!cfg) return [];

  if (cfg.rows && Array.isArray(cfg.rows)) {
    return cfg.rows;
  }

  if (cfg.columns) {
    const cols = cfg.columns;
    const fields = inputFields.value;
    const rows: Array<{ fields: string[]; className?: string }> = [];
    let currentRow: string[] = [];
    let currentCols = 0;

    fields.forEach((f) => {
      const key = getFieldKey(f);
      if (!key) return;

      const fieldCfg = cfg.fieldConfig?.[key];
      const colSpan = fieldCfg?.colSpan || 1;

      if (currentCols + colSpan > cols && currentRow.length > 0) {
        rows.push({ fields: currentRow });
        currentRow = [];
        currentCols = 0;
      }

      currentRow.push(key);
      currentCols += colSpan;

      if (currentCols >= cols) {
        rows.push({ fields: currentRow });
        currentRow = [];
        currentCols = 0;
      }
    });

    if (currentRow.length > 0) {
      rows.push({ fields: currentRow });
    }

    return rows;
  }

  return [];
});

const getRowClass = (row: { fields: string[]; className?: string }) => {
  const baseClass = "grid gap-4 mb-4";
  if (row.className) return `${baseClass} ${row.className}`;

  const fieldCount = row.fields?.length || 1;
  const colSpan = Math.min(fieldCount, 12);

  return `${baseClass} grid-cols-${colSpan}`;
};

const getFieldWrapperClass = (fieldName: string) => {
  const cfg = layoutConfig.value;
  const fieldCfg = cfg?.fieldConfig?.[fieldName];

  if (fieldCfg?.className) return fieldCfg.className;
  if (fieldCfg?.colSpan) return `col-span-${fieldCfg.colSpan}`;

  return "";
};

const filteredAuthProfiles = computed(() => {
  if (!props.currentPlatform) return props.authProfiles || [];
  return (props.authProfiles || []).filter((a) => a.platformId === props.currentPlatform!.id);
});

const getDefaultValue = (field: Field) => {
  if (field.defaultValue !== undefined) return field.defaultValue;
  if (field.type === "array") return [];
  if (field.type === "number") return field.minValue || 0;
  if (field.enumValues && field.enumValues.length > 0) {
    const firstOption = field.enumValues[0];
    return typeof firstOption === "string" ? firstOption : (firstOption?.value ?? "");
  }
  return "";
};

const applyPrefilledData = () => {
  if (!props.prefilledData) return;

  if (props.prefilledData.authProfileId && !formData.selectedAuthId) {
    const exists = filteredAuthProfiles.value.some((a) => a.id === props.prefilledData!.authProfileId);
    if (exists) {
      formData.selectedAuthId = props.prefilledData.authProfileId;
    }
  }

  if (props.prefilledData.input && typeof props.prefilledData.input === "object") {
    Object.entries(props.prefilledData.input).forEach(([key, value]) => {
      if (key in formData || inputFields.value.some((f) => getFieldKey(f) === key)) {
        if (
          formData[key] === undefined ||
          formData[key] === "" ||
          formData[key] === null ||
          (Array.isArray(formData[key]) && (formData[key] as unknown[]).length === 0)
        ) {
          formData[key] = value;
        }
      }
    });
  }
};

const initFormData = () => {
  Object.keys(formData).forEach((k) => {
    if (k !== "selectedAuthId") delete formData[k];
  });
  formData.selectedAuthId = null;
  const fields = inputFields.value;
  if (fields.length > 0) {
    fields.forEach((f) => {
      const key = getFieldKey(f);
      if (key) {
        formData[key] = getDefaultValue(f);
      }
    });
  }
  applyPrefilledData();
};

watch(() => props.currentApi, initFormData, { immediate: true });

watch(
  () => props.prefilledData,
  (newVal) => {
    if (newVal) {
      applyPrefilledData();
    }
  },
  { immediate: true, deep: true },
);

watch(
  filteredAuthProfiles,
  (newProfiles) => {
    if (props.prefilledData?.authProfileId && !formData.selectedAuthId && newProfiles.length > 0) {
      const exists = newProfiles.some((a) => a.id === props.prefilledData!.authProfileId);
      if (exists) {
        formData.selectedAuthId = props.prefilledData.authProfileId;
      }
    }
  },
  { immediate: true },
);

const { uploadingMap, uploadFiles, retryUpload, removeUploadTask } = useImageUpload({
  onSuccess(key, remoteUrl) {
    if (!formData[key]) formData[key] = [];
    (formData[key] as string[]).push(remoteUrl);
  },
  onError(_key, error) {
    console.error("上传失败:", error);
  },
});

const fileInputRefs = ref<Record<string, HTMLInputElement>>({});

const setFileInputRef = (el: HTMLInputElement, key: string) => {
  if (el) fileInputRefs.value[key] = el;
};

const triggerFileSelect = (key: string) => {
  const input = fileInputRefs.value[key];
  if (input) input.click();
};

const handleFileUpload = async (event: Event, key: string) => {
  const target = event.target as HTMLInputElement;
  const files = target.files;
  if (!files || files.length === 0) return;

  await uploadFiles(key, Array.from(files));
  target.value = "";
};

const handleSubmit = () => {
  const data = { ...formData };
  delete data.selectedAuthId;
  emit("submit", {
    authProfileId: formData.selectedAuthId as string | null,
    input: data as Record<string, unknown>,
  });
};

const handleReset = () => {
  initFormData();
  emit("reset");
};

const removeImage = (key: string, idx: number) => {
  if (formData[key]) (formData[key] as unknown[]).splice(idx, 1);
};

const increment = (key: string) => {
  formData[key] = ((formData[key] as number) || 0) + 1;
};

const decrement = (key: string) => {
  formData[key] = Math.max(0, ((formData[key] as number) || 0) - 1);
};
</script>
