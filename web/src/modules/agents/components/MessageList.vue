<template>
    <div class="flex flex-col">
        <!-- Preview mode banner -->
        <div
            v-if="isPreview"
            class="sticky top-0 z-10 flex items-center justify-between px-3 py-1.5 mb-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700"
        >
            <span class="font-medium">预览：{{ previewLabel }}</span>
            <button
                class="ml-2 text-blue-500 hover:text-blue-700 hover:bg-blue-100 rounded px-1.5 py-0.5 transition-colors cursor-pointer"
                @click="clearPreview()"
            >
                ✕ 退出预览
            </button>
        </div>

        <EmptyState v-if="displayMessages.length === 0 && !isLoading" />

        <template v-for="(msg, i) in displayMessages" :key="(msg as any).id ?? i">
            <!-- 人类 -->
            <div v-if="HumanMessage.isInstance(msg)" class="w-full group">
                <HumanBubble :ref="(el) => setHumanRef(msg.id!, el)" :content="msg.text" @edit="handleEdit(msg, $event)"
                    @editing="handleEditing(msg, $event)">
                    <Markdown :content="msg.text" />
                </HumanBubble>
                <div v-if="!isPreview" v-show="!isLoading && !humanEditIds[msg.id || '']" class="h-4 flex items-center gap-1 justify-end">
                    <div class="hidden group-hover:flex items-center gap-1">
                        <button type="button" @click="editHumanMsg(msg.id!)"
                            class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] text-gray-400 hover:text-gray-600 transition-colors cursor-pointer">
                            <EditSharp class="size-2.5" />
                            编辑
                        </button>
                        <button type="button" @click="copyHumanMsg(msg)"
                            class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] transition-colors cursor-pointer"
                            :class="copiedMsgId === msg.id ? 'text-green-500' : 'text-gray-400 hover:text-gray-600'">
                            <DoneSharp v-if="copiedMsgId === msg.id" class="size-2.5" />
                            <ContentCopySharp v-else class="size-2.5" />
                            {{ copiedMsgId === msg.id ? '已复制' : '复制' }}
                        </button>
                    </div>

                    <!-- 分支 -->
                    <BranchNavigator :branch-options="getMessagesMetadata(msg, i)?.branchOptions ?? []"
                        :branch-index="getBranchIndex(msg, i)" @prev="handlePrevBranch(msg, i)"
                        @next="handleNextBranch(msg, i)" />
                </div>
            </div>

            <!-- AI -->
            <template v-else-if="AIMessage.isInstance(msg)">
                <ThinkingBubble :is-streaming="isStreamingReasoning(msg)" class="mb-0.5">
                    <Markdown :content="getReasoningContent(msg)" />
                </ThinkingBubble>

                <AIBubble v-if="msg.text">
                    <Markdown :content="msg.text" />
                </AIBubble>

                <template v-if="!isPreview" v-for="tc in msg.tool_calls" :key="tc.id">
                    <ToolCard :tool-call="toolCallsMap.get(tc.id)" />
                </template>

                <!-- 操作栏 -->
                <div v-if="!isPreview && !isLoading && aiGroupEndIndices.has(i)" class="flex items-center gap-1">
                    <!-- Human: copy + edit -->
                    <template v-if="!AIMessage.isInstance(msg)">
                        <button type="button" @click="handleRegenerateFromIndex(i)"
                            class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-gray-400 hover:text-gray-600 transition-colors cursor-pointer">
                            <ReplaySharp class="size-2.5" />
                            重新生成
                        </button>

                        <!-- 分支 -->
                        <BranchNavigator :branch-options="getMessagesMetadata(msg, i)?.branchOptions ?? []"
                            :branch-index="getBranchIndex(msg, i)" @prev="handlePrevBranch(msg, i)"
                            @next="handleNextBranch(msg, i)" />
                    </template>
                </div>
            </template>
        </template>
        <TypingIndicator v-if="isLoading" :index="messages.length" />
    </div>
</template>

<script setup lang="ts">
import { useStreamContext } from "@langchain/vue"
import { HumanMessage, AIMessage } from "langchain";
import ThinkingBubble from "./ThinkingBubble.vue";
import Markdown from "./Markdown.vue";
import HumanBubble from "./HumanBubble.vue";
import AIBubble from "./AIBubble.vue";
import ToolCard from "./ToolCard.vue";
import { computed, ref } from "vue";
import { ReplaySharp, EditSharp, ContentCopySharp, DoneSharp } from "@vicons/material";
import BranchNavigator from "./BranchNavigator.vue";
import TypingIndicator from "./TypingIndicator.vue";
import EmptyState from "./EmptyState.vue";

import { usePreviewMessages } from "../composables/usePreviewMessages";

const context = useStreamContext();
const { submit, messages, isLoading, getMessagesMetadata, setBranch } = context
const { previewMessages, previewLabel, clearPreview } = usePreviewMessages()
const isPreview = computed(() => previewMessages.value !== null)
const displayMessages = computed(() => previewMessages.value ?? messages.value);
(window as any).ccc = computed(() => {
    return messages.value.map(m => {
        return { message: m, metedata: getMessagesMetadata(m) }
    })
})

const humanBubbleRefs = new Map<string, any>();
function setHumanRef(id: string, el: any) {
    if (el) humanBubbleRefs.set(id, el);
    else humanBubbleRefs.delete(id);
}

const copiedMsgId = ref<string | null>(null);
async function copyHumanMsg(msg: any) {
    const text = typeof msg.text === 'string' ? msg.text : '';
    await navigator.clipboard.writeText(text);
    copiedMsgId.value = msg.id;
    setTimeout(() => { copiedMsgId.value = null; }, 2000);
}

function editHumanMsg(id: string) {
    humanBubbleRefs.get(id)?.startEdit?.();
}

const humanEditIds = ref<Record<string, boolean>>({})
function handleEditing(message: HumanMessage, editing: boolean) {
    const id = message.id
    if (!id) return
    humanEditIds.value[id] = editing
}

// 记录每个 AI 消息分组最后一条消息的索引
// 消息序列示例：[human, ai, ai, ai, human, ai, ai] → indices = {3, 6}
// 用于在每组 AI 消息结束后插入操作栏等额外内容
const aiGroupEndIndices = computed(() => {
    const indices = new Set<number>()
    const msgs = displayMessages.value
    for (let i = 0; i < msgs.length; i++) {
        if (!HumanMessage.isInstance(msgs[i])) {
            if (i === msgs.length - 1 || HumanMessage.isInstance(msgs[i + 1])) {
                indices.add(i)
            }
        }
    }
    return indices
})

const toolCallsMap = computed(() => {
    const map = new Map()
    const toolCalls: any[] = (context as any).toolCalls.value
    if (toolCalls && Array.isArray(toolCalls)) {
        toolCalls.forEach((tc) => {
            map.set(tc.call.id, tc)
        })
    }
    return map
})

const isStreamingReasoning = (msg: AIMessage) => {
    return (
        !isPreview.value &&
        isLoading.value &&
        (displayMessages.value[displayMessages.value.length - 1] as any)?.id === msg.id
    );
}

const getReasoningContent = (msg: AIMessage) => {
    const reasoning_content = String(msg.additional_kwargs?.reasoning_content)
    return reasoning_content ?? (
        msg.contentBlocks
            ?.filter(
                (block: any) =>
                    block.type === "reasoning" &&
                    typeof block.reasoning === "string" &&
                    block.reasoning.trim().length > 0,
            )
            .map((block: any) => block.reasoning)
            .join("").trim() ?? "")
}

const handleEdit = (msg: HumanMessage, text: string) => {
    const metadata = getMessagesMetadata(msg)
    if (!metadata) return
    const checkpoint = metadata.firstSeenState?.parent_checkpoint;
    if (!checkpoint) return
    submit(
        { messages: [new HumanMessage({ content: text })] },
        { checkpoint }
    );
}

function getBranchIndex(msg: any, i: number): number {
    const meta = getMessagesMetadata(msg, i);
    if (!meta?.branchOptions?.length) return -1;
    const branch = meta.branch ?? meta.branchOptions[meta.branchOptions.length - 1] ?? '';
    return meta.branchOptions.indexOf(branch);
}

function handlePrevBranch(msg: any, i: number) {
    const meta = getMessagesMetadata(msg, i);
    if (!meta?.branchOptions?.length) return;
    const idx = getBranchIndex(msg, i);
    const prev = meta.branchOptions[idx - 1];
    if (prev) setBranch(prev);
}

function handleNextBranch(msg: any, i: number) {
    const meta = getMessagesMetadata(msg, i);
    if (!meta?.branchOptions?.length) return;
    const idx = getBranchIndex(msg, i);
    const next = meta.branchOptions[idx + 1];
    if (next) setBranch(next);
}

function handleRegenerate(msg: AIMessage) {
    const metadata = getMessagesMetadata(msg)
    if (!metadata) return
    const checkpoint = metadata.firstSeenState?.parent_checkpoint;
    if (!checkpoint) return;
    submit(undefined, { checkpoint });
}

function handleRegenerateFromIndex(index: number) {
    const msg = messages.value[index];
    if (!msg) return;
    // 依次向前查询， 向前找到第一个 Human消息，然后获取后面的消息
    let firstAIInGroup = index;
    for (let i = index - 1; i >= 0; i--) {
        if (HumanMessage.isInstance(messages.value[i])) break;
        firstAIInGroup = i;
    }
    const firstMsg = messages.value[firstAIInGroup];
    if (!firstMsg || !AIMessage.isInstance(firstMsg)) return;
    handleRegenerate(firstMsg)
}
</script>