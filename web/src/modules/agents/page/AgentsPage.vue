<template>
  <div class="flex gap-6 h-full">
    <!-- <Demo /> -->

    <div class="flex-1 w-full h-full">
      <ChatContainer />
    </div>
  </div>
</template>

<script setup lang="ts">
import Demo from "./Demo.vue";
import ChatContainer from "../components/ChatContainer.vue";

import { provideStream } from "@langchain/vue";
provideStream({
  assistantId: "tool_calling",
});
</script>
