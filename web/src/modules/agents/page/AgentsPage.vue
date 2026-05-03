<template>
  <StreamProvider
    v-if="agentsStore.assistantId"
    :key="agentsStore.assistantId"
    :assistantId="agentsStore.assistantId"
    :initialThreadId="(route.query.threadId as string) ?? undefined"
    class="flex gap-6 h-full"
  >
    <Demo class="w1/3 hidden" />
    <div class="flex-1 w-full h-full">
      <ChatContainer />
    </div>
  </StreamProvider>
</template>

<script setup lang="ts">
import ChatContainer from "../components/ChatContainer.vue";
import StreamProvider from "../components/StreamProvider.vue";
import Demo from "./Demo.vue";

import { useRoute } from "vue-router";
import { useAgentsStore } from "@/stores";

const route = useRoute();
const agentsStore = useAgentsStore();
</script>
