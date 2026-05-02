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

import { ref } from "vue";
import { useRouter } from "vue-router";
import { provideStream } from "@langchain/vue";

const router = useRouter();

const threadId = ref<string | undefined>(
  new URLSearchParams(window.location.search).get("threadId") ?? undefined,
);

function onThreadId(newId?: string) {
  threadId.value = newId;
  router.replace({
    query: newId !== undefined ? { threadId: newId } : {},
  });
}

provideStream({
  assistantId: "tool_calling",
  threadId: threadId.value,
  onThreadId,
  fetchStateHistory: true,
});
</script>
