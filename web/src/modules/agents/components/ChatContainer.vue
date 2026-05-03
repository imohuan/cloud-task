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
                <ChatInput :isLoading="isLoading" :models="MODELS" v-model:modelId="selectedModelId" @send="onSend" />
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
import type { ChatModel } from "./ChatInput.vue"
import { useAuthProfileStore } from "@/stores";
import { API_BASE } from "@/config";

const scrollEl = ref<HTMLElement | null>(null)
const authProfile = useAuthProfileStore()

const MODELS: ChatModel[] = [
  { id: "deepseek-v4-flash",          name: "DeepSeek V4 Flash", desc: "快速推理，低延迟" },
  { id: "deepseek-v4-pro",            name: "DeepSeek V4 Pro",   desc: "更强推理能力" },
  { id: "kimi-k2.6",                  name: "Kimi K2.6",         desc: "月之暗面旗舰模型" },
  { id: "glm-5.1",                    name: "GLM 5.1",           desc: "智谱 AI 最新版" },
  { id: "claude-opus-4-7",            name: "Claude Opus 4.7",   desc: "Anthropic 旗舰" },
  { id: "gpt-5.4-nano-2026-03-17",    name: "GPT-5.4 Nano",      desc: "OpenAI 轻量模型" },
]
const selectedModelId = ref(MODELS[0]!.id)
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

    submit({
        messages: [message],
    }, {
        context: {
            auth_id: authProfile.profiles[0]?.id || "",
            model_id: selectedModelId.value,
            api_url: API_BASE
        },
    });
    setTimeout(() => {
        scrollToBottom()
    }, 500);
}
</script>