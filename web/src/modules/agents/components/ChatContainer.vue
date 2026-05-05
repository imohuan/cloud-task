<template>
    <div class="relative h-full overflow-hidden">
        <CheckpointTimeline />
        <div class="h-full flex flex-col gap-2 p-2 pr-0 lg:p-5">
            <div class="relative w-full flex-1 h-full overflow-hidden">
                <div ref="scrollEl" class="w-full h-full overflow-y-auto pt-2 pr-4">
                    <MessageList class="max-w-4xl m-auto" />
                </div>
                <ScrollToBottom :scroll-el="scrollEl" />
            </div>

            <div class="w-full max-w-4xl m-auto flex flex-col gap-2 pr-4">
                <ErrorBanner v-if="error != null" :error="error" />
                <ChatInput :isLoading="isLoading" :models="MODELS" v-model:modelId="selectedModelId" @send="onSend" @stop="stop"
                    :assistants="assistants" v-model:assistantId="agentStore.assistantId" />
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import ChatInput, { type ChatImage } from "./ChatInput.vue";
import ErrorBanner from "./ErrorBanner.vue";
import CheckpointTimeline from "./CheckpointTimeline.vue";
import { useStreamContext } from "../composables/useStreamContext"
import { HumanMessage } from "langchain"
import MessageList from "./MessageList.vue"
import ScrollToBottom from "./ScrollToBottom.vue"
import { ref, nextTick, computed } from "vue"
import type { ChatModel } from "./ChatInput.vue"

import { useAgentsStore, useAuthProfileStore } from "@/stores";
import { API_BASE } from "@/config";
import { useRoute } from "vue-router";
import { formatModelName } from "@/utils/model";

const scrollEl = ref<HTMLElement | null>(null)
const authProfile = useAuthProfileStore()
const agentStore = useAgentsStore()
const assistants = computed(() => agentStore.assistants)
const route = useRoute()
const threadId = computed(() => {
    const id = route.query.threadId
    agentStore.selectConversation(String(id))
    return id
})

agentStore.selectConversation(String(threadId.value))

const DEFAULT_MODELS: ChatModel[] = [
    { id: "gpt-5.4-nano", name: "GPT-5.4 Nano", desc: "OpenAI 轻量模型" },
    { id: "kimi-k2.6", name: "Kimi K2.6", desc: "月之暗面旗舰模型" },
    { id: "glm-5.1", name: "GLM 5.1", desc: "智谱 AI 最新版" },
    { id: "deepseek-v4-flash", name: "DeepSeek V4 Flash", desc: "快速推理，低延迟" },
    { id: "deepseek-v4-pro", name: "DeepSeek V4 Pro", desc: "更强推理能力" },
    { id: "claude-opus-4-7", name: "Claude Opus 4.7", desc: "Anthropic 旗舰" },
]

const MODELS = computed<ChatModel[]>(() => {
    const models = authProfile.currentProfile?.credentials?.models
    if (!models?.length) return DEFAULT_MODELS
    return models.map((id) => ({ id, name: formatModelName(id) }))
})

const _selectedModelId = ref(MODELS.value[0]?.id ?? "")
const selectedModelId = computed({
    get: () => {
        const models = MODELS.value
        return models.find((m) => m.id === _selectedModelId.value)
            ? _selectedModelId.value
            : (models[0]?.id ?? "")
    },
    set: (val: string) => { _selectedModelId.value = val },
})
const { submit, isLoading, error, stop } = useStreamContext();

function scrollToBottom() {
    nextTick(() => scrollEl.value?.scrollTo({ top: scrollEl.value.scrollHeight, behavior: 'instant' }))
}

function handleRefresh() {
    if (threadId.value && threadId.value.length > 0) {
        return
    }

    // 刷新列表
    async function retry() {
        const next = () => setTimeout(() => retry(), 3000)
        if (!threadId.value) return next()
        const thread = await agentStore.fetchThread(String(threadId.value))
        if (!thread) return next()
        const existingIndex = agentStore.threads.findIndex(t => t.thread_id === thread.thread_id)
        if (existingIndex === -1) {
            agentStore.threads.unshift(thread)
        } else if (thread.metadata?.title) {
            agentStore.threads[existingIndex] = thread
        }
        if (!thread.metadata?.title) return next()
    }

    retry()
}

function onSend(text: string, _images: ChatImage[]) {
    if (isLoading.value) return
    handleRefresh()

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
            model: {
                auth_id: authProfile.selectedProfileId || "",
                model_id: selectedModelId.value,
                api_url: API_BASE
            }
        },
    });
    setTimeout(() => {
        scrollToBottom()
    }, 500);
}
</script>