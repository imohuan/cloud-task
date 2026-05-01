<template>
    <div class="w-full max-w-xl m-auto h-full flex flex-col gap-2">
        <MessageList />
        
        <div v-if="error != null"
            class="px-3.5 py-2.5 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-400 text-sm">
            <strong>Error:</strong>
            <span class="opacity-90">{{ error instanceof Error ? error.message : String(error) }}</span>
        </div>

        <ChatInput :isLoading="isLoading" @send="onSend" />
    </div>
</template>

<script setup lang="ts">
import ChatInput from "./ChatInput.vue";
import { useStreamContext } from "@langchain/vue"
import { HumanMessage } from "langchain"
import MessageList from "./MessageList.vue"

const { submit, isLoading, error } = useStreamContext();

function onSend(text: string, images: any[]) {
    submit({ messages: [new HumanMessage(text), ...images.map((img) => new HumanMessage(img.url))] });
}
</script>