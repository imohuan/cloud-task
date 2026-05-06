<template>
  <div class="relative flex h-full w-full">
    <StreamProvider
      v-if="agentsStore.assistantId"
      :key="agentsStore.assistantId"
      :assistantId="agentsStore.assistantId"
      :initialThreadId="(route.query.threadId as string) ?? undefined"
      class="flex gap-6 h-full w-full"
      @loading="isLoading = $event"
    >
      <Demo class="w1/3 hidden" />
      <div class="flex-1 w-full h-full">
        <ChatContainer />
      </div>
    </StreamProvider>

    <Transition name="fade">
      <div
        v-if="isLoading"
        class="absolute inset-0 z-10 flex items-center justify-center bg-white/70 backdrop-blur-sm"
      >
        <LoadingSpinner :size="36" :thickness="3" colorClass="text-blue-500" text="加载中..." />
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import ChatContainer from "../components/ChatContainer.vue";
import StreamProvider from "../components/StreamProvider.vue";
import Demo from "./Demo.vue";
import LoadingSpinner from "@/components/LoadingSpinner.vue";

import { ref } from "vue";
import { useRoute } from "vue-router";
import { useAgentsStore } from "@/stores";

const route = useRoute();
const agentsStore = useAgentsStore();

const isLoading = ref(false);
</script>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
