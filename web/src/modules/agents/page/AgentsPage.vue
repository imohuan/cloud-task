<template>
  <div class="flex gap-6 h-full">
    <!-- <Demo class="w1/3" /> -->
    <div class="flex-1 w-full h-full">
      <ChatContainer />
    </div>
  </div>
</template>

<script setup lang="ts">
import ChatContainer from "../components/ChatContainer.vue";

import { ref, watch } from "vue";
import { useRouter, useRoute } from "vue-router";
import { provideStream } from "@langchain/vue";
import { useAgentsStore } from "@/stores";

const router = useRouter();
const route = useRoute();
const agentsStore = useAgentsStore();

const threadId = ref<string | undefined>(
  (route.query.threadId as string) ?? undefined,
);


const stream = provideStream({
  assistantId: "tool_calling",
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
}
</script>
