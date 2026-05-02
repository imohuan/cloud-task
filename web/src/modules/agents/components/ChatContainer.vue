<template>
    <div class="relative h-full overflow-hidden">
        <CheckpointTimeline />
        <div class="h-full flex flex-col gap-2 p-3 pr-0 lg:p-6">
            <div class="relative w-full flex-1 h-full overflow-hidden">
                <div ref="scrollEl" class="w-full h-full overflow-y-auto pt-2 pr-3">
                    <MessageList class="max-w-xl m-auto" />
                </div>
                <ScrollToBottom :scroll-el="scrollEl" />
            </div>

            <div class="w-full max-w-xl m-auto flex flex-col gap-2 pr-3">
                <ErrorBanner v-if="error != null" :error="error" />
                <ChatInput :isLoading="isLoading" @send="onSend" />
            </div>
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
import ScrollToBottom from "./ScrollToBottom.vue"
import { ref, nextTick } from "vue"

const scrollEl = ref<HTMLElement | null>(null)

const { submit, isLoading, error } = useStreamContext();

function scrollToBottom() {
    nextTick(() => scrollEl.value?.scrollTo({ top: scrollEl.value.scrollHeight, behavior: 'instant' }))
}

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
    setTimeout(() => {
        scrollToBottom()
    }, 500);
}
</script>