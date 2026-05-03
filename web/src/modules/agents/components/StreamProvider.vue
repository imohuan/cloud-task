<template>
  <div v-bind="$attrs">
    <slot />
  </div>
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false })
import { ref, watch } from "vue";
import { useRouter, useRoute } from "vue-router";
import { provideStream } from "../composables/useStreamContext";
import { useAgentsStore } from "@/stores";

const props = defineProps<{
  assistantId: string;
  initialThreadId?: string;
}>();

const emit = defineEmits<{
  threadId: [id: string | undefined];
}>();

const router = useRouter();
const route = useRoute();
const agentsStore = useAgentsStore();

const threadId = ref<string | undefined>(props.initialThreadId);

const stream = provideStream({
  assistantId: props.assistantId,
  threadId: threadId.value,
  onThreadId,
  fetchStateHistory: true,
});

watch(
  () => route.query.threadId,
  (newId) => {
    const id = (newId as string) ?? undefined;
    if (id !== threadId.value) {
      threadId.value = id;
      stream.switchThread(id);
    }
  },
);

function onThreadId(newId?: string) {
  threadId.value = newId;
  agentsStore.selectConversation(newId);
  router.replace({
    query: newId !== undefined ? { threadId: newId } : {},
  });
  emit("threadId", newId);
}
</script>
