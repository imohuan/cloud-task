<template>
    <div class="w-full max-w-xl m-auto h-full flex flex-col gap-2">
        <MessageList />
        <ErrorBanner v-if="error != null" :error="error" />
        <ChatInput :isLoading="isLoading" @send="onSend" />
    </div>
</template>

<script setup lang="ts">
import ChatInput from "./ChatInput.vue";
import ErrorBanner from "./ErrorBanner.vue";
import { useStreamContext } from "@langchain/vue"
import { HumanMessage } from "langchain"
import MessageList from "./MessageList.vue"

const { submit, isLoading, error } = useStreamContext();

function onSend(text: string, images: any[]) {
    submit({ messages: [new HumanMessage(text), ...images.map((img) => new HumanMessage(img.url))] });
}
</script>