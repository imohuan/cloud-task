<template>
  <div class="space-y-1">
    <TaskItemHeader :reference-images="referenceImages" :prompt="prompt" :api-name="apiName"
      :resource-type="resourceType" :display-model="displayModel" :resolution="input.resolution" :elapsed="task.elapsed"
      :completed-at="completedAt" @use-prompt="emit('use-prompt', $event)" />

    <!-- 内容部分 -->
    <div class="relative max-h-[500px]"
      :class="imageResources.length ? 'max-w-[800px]' : textResources.length && !hasMediaResources ? 'w-full' : 'max-w-[500px]'">
      <StatusError v-if="displayStatus === 'error'" :error="task.error" />
      <StatusEmpty v-else-if="displayStatus === 'success' && !hasMediaResources && !textResources.length" />
      <StatusPending v-else-if="displayStatus === 'pending'" :resource-type="resourceType" />
      <StatusProcessing v-else-if="displayStatus === 'processing'" :resource-type="resourceType"
        :progress="task.progress || 0" />
      <StatusSuccess v-else-if="displayStatus === 'success'" :text-resources="textResources"
        :image-resources="imageResources" :video-resources="videoResources" :audio-resources="audioResources"
        :file-resources="fileResources" :prompt="prompt" />
      <StatusDefault v-else />
    </div>

    <TaskItemActions v-if="!hideActions" :task-id="task.taskId || task.id" :status="displayStatus"
      @regenerate="emit('regenerate', task)" @quote-task="emit('quote-task', task)"
      @view-log="router.push({ name: 'task-detail', params: { taskId: task.taskId || task.id } })"
      @delete="emit('delete', $event)" @cancel="emit('cancel', task)" />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { useRegistryStore } from "@/stores/useRegistryStore";
import TaskItemHeader from "./TaskItemHeader.vue";
import TaskItemActions from "./TaskItemActions.vue";
import StatusError from "./StatusError.vue";
import StatusEmpty from "./StatusEmpty.vue";
import StatusPending from "./StatusPending.vue";
import StatusProcessing from "./StatusProcessing.vue";
import StatusSuccess from "./StatusSuccess.vue";
import StatusDefault from "./StatusDefault.vue";
import { getImageUrl } from "@/config";

const props = defineProps<{
  task: any;
  resourceTypeOverride?: string;
  hideActions?: boolean;
}>();

const emit = defineEmits<{
  (e: "use-prompt", prompt: string): void;
  (e: "regenerate", task: any): void;
  (e: "delete", taskId: string): void;
  (e: "quote-task", task: any): void;
  (e: "cancel", task: any): void;
}>();

const router = useRouter();

const registryStore = useRegistryStore();

const apiInfo = computed(() => registryStore.getApiById(props.task.apiId));
const categoryInfo = computed(() => {
  const api = apiInfo.value;
  if (!api?.categoryId) return null;
  return registryStore.categories.find((c: any) => c.id === api.categoryId);
});

const resourceType = computed(() => props.resourceTypeOverride || categoryInfo.value?.id || "image");
const apiName = computed(() => apiInfo.value?.name || registryStore.getApiNameById(props.task.apiId) || "未知 API");

const input = computed(() => props.task.input || {});
const prompt = computed(() => (input.value as any).prompt || "");
const displayModel = computed(() => {
  const m = (input.value as any).model;
  if (!m) return "";
  const id = typeof m === "object" ? m?.id || "" : String(m);
  const api = apiInfo.value as any;
  const modelField = api?.inputSchema?.fields?.find((f: any) => f.name === "model");
  const match = modelField?.enumValues?.find((ev: any) => ev.value === id);
  return match?.label || id;
});
const referenceImages = computed(() => [...(input.value?.referenceImages || []), ...(input.value?.image || [])]);
const outputContent = computed(() => {
  return (props.task.output?.content || []).map((item: any) => {
    return { ...item, url: getImageUrl(item?.url)}
  })
});

const displayStatus = computed(() => {
  const s = props.task.status;
  if (s === "completed") return "success";
  if (s === "running" || s === "polling" || s === "polling-run") return "processing";
  if (s === "failed") return "error";
  return "pending";
});

const imageResources = computed(() => outputContent.value.filter((c: any) => c.type === "image" && c.url));
const videoResources = computed(() => outputContent.value.filter((c: any) => c.type === "video" && c.url));
const audioResources = computed(() => outputContent.value.filter((c: any) => c.type === "audio" && c.url));
const textResources = computed(() => outputContent.value.filter((c: any) => c.type === "text" && c.text));
const fileResources = computed(() => outputContent.value.filter((c: any) => c.type === "file" && c.url));

const hasMediaResources = computed(
  () =>
    imageResources.value.length > 0 ||
    videoResources.value.length > 0 ||
    audioResources.value.length > 0 ||
    fileResources.value.length > 0,
);

function formatTime(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const completedAt = computed(() => formatTime(props.task.completedAt));
</script>
