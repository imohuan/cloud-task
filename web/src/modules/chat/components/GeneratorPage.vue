<template>
  <div ref="rootRef" class="flex h-full flex-col bg-slate-50">
    <div ref="scrollRef" class="scrollbar-lager flex-1 space-y-6 overflow-y-auto"
      :style="`margin-bottom: ${-marginBottom}px`">
      <template v-if="taskStore.loading">
        <div class="flex flex-1 items-center justify-center py-20">
          <LoadingSpinner :size="40" :thickness="4" text="加载中..." />
        </div>
      </template>
      <template v-else-if="tasks.length">
        <div v-for="task in tasks" :key="task.id || task.taskId" class="mx-auto" :style="{ width: boxWidth + 'px' }">
          <ResourceTaskItem :task="task" @use-prompt="onUsePrompt" @regenerate="onRegenerate" @delete="onDeleteTask"
            @quote-task="onQuoteTask" @view-log="onViewLog" />
        </div>
      </template>
      <div v-else class="mx-auto flex flex-col items-center justify-center py-20 text-slate-400"
        :style="{ width: boxWidth + 'px' }">
        <i class="fa-regular fa-clipboard mb-3 text-4xl opacity-30"></i>
        <p class="text-sm">暂无任务</p>
      </div>
    </div>
    <div class="relative z-30 mx-auto bg-gradient-to-t from-slate-50 to-transparent" :style="panelWrapStyle">
      <GeneratorInputPanel ref="inputPanelRef" :preview-mode="false" v-model:loading="isGenerating"
        @generate="onGenerate" @focus="onFocus" @dragging="onDragging" />
      <button v-if="!isNearBottom" @click="scrollToBottom"
        class="absolute -top-16 right-3 z-30 flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-md transition-all hover:bg-slate-50 hover:text-slate-700 active:scale-95"
        title="滚动到底部">
        <i class="fa-solid fa-arrow-down text-base"></i>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, inject } from "vue";
import GeneratorInputPanel from "./GeneratorInputPanel.vue";
import ResourceTaskItem from "./ResourceTaskItem/index.vue";
import LoadingSpinner from "@/components/LoadingSpinner.vue";
import { useTaskStore } from "@/stores/useTaskStore";
import { useAuthProfileStore } from "@/stores/useAuthProfileStore";
import { useRegistryStore } from "@/stores/useRegistryStore";
import { taskApi } from "@/api";
import { useScrollNearBottom } from "../composables/useScrollNearBottom";
import { useElementSize } from "../composables/useElementSize";
import { useLoading } from "@/composables/useLoading";
import { useToast } from "../composables/useToast";
import { useAppStore } from "@/stores";

const appStore = useAppStore();
const layoutContext = inject<any>("layoutContext");

const rootRef = ref<HTMLElement | null>(null);
const { width: _rW } = useElementSize(rootRef);

const rW = computed(() => {
  if (!appStore.isMobile) return _rW.value
  // 如果是本地的话
  return _rW.value * 1.12
})

const boxWidth = computed(() => Math.min(rW.value * 0.8, 1200));
const marginBottom = computed(() => {
  const scale = appStore.isMobile ? 0.5 : 0.9;
  return 180 - 180 * scale
})

const panelWrapStyle = computed(() => {
  const scale = appStore.isMobile ? 0.5 : 0.8;
  const width = appStore.isMobile ? boxWidth.value * 2 : boxWidth.value / 0.8
  const offsetX = (width - _rW.value) / 2 * 2

  return {
    width: `${width}px`,
    transform: `scale(${scale}) translate3D(-${offsetX}px, -18px, 0)`,
    transformOrigin: "bottom center",
  }
});

const scrollRef = ref<HTMLElement | null>(null);
const { isNearBottom } = useScrollNearBottom(scrollRef, 100);
const { showToast } = useToast();

const inputPanelRef = ref<InstanceType<typeof GeneratorInputPanel> | null>(null);
const tasks = computed(() => {
  const rawTasks = taskStore.tasks || [];
  return [...rawTasks].reverse();
});

// const previewMode = ref(false);
// watch(isNearBottom, async () => {
//   const el = scrollRef.value;
//   if (!el) return;
//   const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
//   disable();
//   previewMode.value = !isNearBottom.value;
//   await nextTick();
//   setTimeout(() => {
//     if (previewMode.value === false) {
//       el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
//     } else {
//       const target = el.scrollHeight - el.clientHeight - distanceFromBottom;
//       if (Math.abs(el.scrollTop - target) > 1) {
//         el.scrollTop = Math.max(0, target);
//       }
//     }
//     setTimeout(() => enable(), 500);
//   }, 100);
// });

const taskStore = useTaskStore();
const authProfileStore = useAuthProfileStore();
const registryStore = useRegistryStore();
const { loading: isGenerating, withLoading } = useLoading();

watch(
  () => taskStore.loading,
  async (isLoading) => {
    if (!isLoading) {
      await nextTick();
      requestAnimationFrame(() => scrollToBottom());
    }
  },
);

watch(
  () => taskStore.tasks.length,
  async () => {
    await nextTick();
    requestAnimationFrame(() => scrollToBottom());
  },
);

async function onGenerate(prompt: string, refs: string[], config: any) {
  await withLoading(async () => {
    const apiId = config.apiId;
    if (!apiId) {
      showToast("未选择 API", "warning");
      return;
    }
    const api = registryStore.getApiById(apiId);
    const profiles = authProfileStore.getProfilesByPlatform(api?.platformId || "");
    const authProfileId = profiles.find((p: any) => p.enabled)?.id || profiles[0]?.id;
    if (!authProfileId) {
      showToast("未找到认证配置", "warning");
      return;
    }
    // 根据 API schema 的 abilities 找到对应的实际字段名
    const schemaFields: any[] = (api as any)?.inputSchema?.fields || [];
    const fieldNameByAbility = (abilityName: string, fallback: string): string => {
      const field = schemaFields.find((f: any) => f.abilities?.some((a: any) => a.name === abilityName));
      return field?.name || fallback;
    };

    const input: any = {
      [fieldNameByAbility("prompt", "prompt")]: prompt,
      [fieldNameByAbility("model", "model")]: config.model || "",
    };

    const sizeValue = config.ratio || config.resolution;
    if (sizeValue !== undefined) {
      input[fieldNameByAbility("size", "size")] = sizeValue;
    }

    if (config.n !== undefined) {
      input[fieldNameByAbility("n", "n")] = config.n;
    }

    if (refs.length > 0) {
      input[fieldNameByAbility("image", "referenceImages")] = refs;
    }

    if (config.width) input.width = config.width;
    if (config.height) input.height = config.height;

    // 透传 config 中的其他自定义字段（customParameterFields 按 field.name 存储）
    const skipKeys = ["type", "model", "ratio", "resolution", "apiId", "n", "width", "height"];
    Object.keys(config).forEach((key) => {
      if (!skipKeys.includes(key)) {
        input[key] = config[key];
      }
    });
    try {
      const res = await taskApi.createTask(apiId, authProfileId, input);
      if ((res as any)?.success) {
        showToast("任务创建成功", "success");
      } else {
        showToast(`创建任务失败: ${(res as any)?.error}`, "error");
      }
    } catch (e) {
      showToast(`创建任务异常: ${e}`, "error");
    }
  });
}

async function onDeleteTask(taskId: string) {
  try {
    await taskStore.deleteTask(taskId);
  } catch (e) {
    console.error("删除任务失败:", e);
  }
}

async function onRegenerate(task: any) {
  const apiId = task.apiId;
  if (!apiId) {
    console.warn("未选择 API");
    return;
  }
  const api = registryStore.getApiById(apiId);
  const profiles = authProfileStore.getProfilesByPlatform(api?.platformId || "");
  const authProfileId = profiles.find((p: any) => p.enabled)?.id || profiles[0]?.id;
  if (!authProfileId) {
    console.warn("未找到认证配置");
    return;
  }
  try {
    const res = await taskApi.createTask(apiId, authProfileId, task.input);
    if ((res as any)?.success) {
      showToast("任务重新创建成功", "success");
    } else {
      console.error("重新创建任务失败:", (res as any)?.error);
    }
  } catch (e) {
    console.error("重新创建任务异常:", e);
  }
}

function onQuoteTask(task: any) {
  const input = task.input || {};
  if (!inputPanelRef.value) return;

  const api = registryStore.getApiById(task.apiId);
  const schemaFields: any[] = (api as any)?.inputSchema?.fields || [];
  const fieldNameByAbility = (abilityName: string, fallback: string): string => {
    const field = schemaFields.find((f: any) => f.abilities?.some((a: any) => a.name === abilityName));
    return field?.name || fallback;
  };
  const inputValueByAbility = (abilityName: string, fallback: string) =>
    input[fieldNameByAbility(abilityName, fallback)];

  const promptValue = inputValueByAbility("prompt", "prompt");
  if (promptValue) {
    inputPanelRef.value.setPrompt(promptValue);
  }

  const refs = inputValueByAbility("image", "referenceImages")?.length
    ? inputValueByAbility("image", "referenceImages")
    : input.referenceImages?.length
      ? input.referenceImages
      : input.images || [];
  inputPanelRef.value.setReferenceImages(refs);

  const categoryId = task.categoryId || api?.categoryId || "image";
  const config: any = {
    type: categoryId,
    apiId: task.apiId,
    platformId: api?.platformId,
  };

  const modelValue = inputValueByAbility("model", "model");
  if (modelValue) config.model = modelValue;

  const nValue = inputValueByAbility("n", "n");
  if (nValue !== undefined) config.n = nValue;
  if (input.width) config.width = input.width;
  if (input.height) config.height = input.height;

  const sizeValue = inputValueByAbility("size", "size");
  if (input.resolution) {
    config.resolution = input.resolution;
  } else if (input.ratio) {
    config.ratio = input.ratio;
  } else if (sizeValue) {
    if (String(sizeValue).includes("x")) {
      config.resolution = sizeValue;
    } else {
      config.ratio = sizeValue;
    }
  }

  const reservedFieldNames = new Set([
    fieldNameByAbility("prompt", "prompt"),
    fieldNameByAbility("model", "model"),
    fieldNameByAbility("n", "n"),
    fieldNameByAbility("image", "referenceImages"),
    fieldNameByAbility("size", "size"),
    "referenceImages",
    "images",
    "width",
    "height",
    "resolution",
    "ratio",
  ]);

  Object.entries(input).forEach(([key, value]) => {
    if (reservedFieldNames.has(key) || value === undefined || value === null) return;
    config[key] = value;
  });

  inputPanelRef.value.setConfig(config);
}

function onViewLog(task: any) {
  const taskId = task.taskId || task.id;
  layoutContext?.setCurrentTaskId(taskId);
}

function onUsePrompt(prompt: string) {
  inputPanelRef.value?.setPrompt(prompt);
}

function onFocus() {
  scrollToBottom();
}

function onDragging(_isDragging: boolean) { }

function scrollToBottom() {
  const el = scrollRef.value;
  if (!el) return;
  el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
}

onMounted(async () => {
  await nextTick();
  requestAnimationFrame(() => {
    scrollToBottom();
  });

  if (document.getElementById("generator-panel-styles")) return;
  const style = document.createElement("style");
  style.id = "generator-panel-styles";
  style.textContent = `
    .image-card { position: absolute; }
    .add-button.is-dragging { border-color: #3b82f6; background-color: #eff6ff; }
    @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
    .animate-bounce-custom { animation: bounce 1s infinite; }
    .dropdown-backdrop { transition: opacity 0.15s ease; }
    .dropdown-backdrop-enter-from, .dropdown-backdrop-leave-to { opacity: 0; }
  `;
  document.head.appendChild(style);
});
</script>
