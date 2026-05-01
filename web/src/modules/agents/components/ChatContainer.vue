<template>
    <div class="relative h-full flex flex-col gap-2 overflow-hidden">
        <CheckpointTimeline />
        <div class="w-full flex-1 h-full overflow-y-auto pt-2">
            <MessageList class="max-w-xl m-auto" />
        </div>

        <div class="w-full max-w-xl m-auto flex flex-col gap-2">
            <ErrorBanner v-if="error != null" :error="error" />
            <ChatInput :isLoading="isLoading" @send="onSend" />
        </div>
    </div>
</template>

<script setup lang="ts">
import ChatInput from "./ChatInput.vue";
import ErrorBanner from "./ErrorBanner.vue";
import CheckpointTimeline from "./CheckpointTimeline.vue";
import { useStreamContext } from "@langchain/vue"
import { HumanMessage } from "langchain"
import MessageList from "./MessageList.vue"

const { submit, isLoading, error, queue } = useStreamContext();

function onSend(text: string, _images: any[]) {
    if (isLoading.value) return
    // images.map((img) => new HumanMessage(img.url))
    submit({ messages: [new HumanMessage(text)] });
    // submit({ messages: [{ type: "human", content: "直接回复我: 1?" }] },);
    // setTimeout(() => {
    //     submit({ messages: [{ type: "human", content: "直接回复我: 2?" }] },);
    //     submit({ messages: [{ type: "human", content: "直接回复我: 3?" }] },);
    // }, 1000);
}
</script>