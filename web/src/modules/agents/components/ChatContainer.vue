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
import ChatInput, { type ChatImage } from "./ChatInput.vue";
import ErrorBanner from "./ErrorBanner.vue";
import CheckpointTimeline from "./CheckpointTimeline.vue";
import { useStreamContext } from "@langchain/vue"
import { HumanMessage } from "langchain"
import MessageList from "./MessageList.vue"

const { submit, isLoading, error } = useStreamContext();

function onSend(text: string, _images: ChatImage[]) {
    if (isLoading.value) return

    const message = _images.length === 0
        ? new HumanMessage(text)
        : new HumanMessage({
            content: [
                { type: "text", text },
                ..._images.map(img => ({ type: "image_url", image_url: { url: img.url } }))
            ]
        });

    submit({ messages: [message] });
}
</script>