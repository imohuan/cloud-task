<template>
    <div class="h-full flex flex-col overflow-y-auto">
        <template v-for="(msg, i) in messages" :key="msg.id ?? i">
            <!-- 人类 -->
            <HumanBubble v-if="HumanMessage.isInstance(msg)" :ref="(el) => setHumanRef(msg.id!, el)" :content="msg.text" @edit="handleEdit(msg, $event)">
                <Markdown :content="msg.text" />
            </HumanBubble>

            <!-- AI -->
            <template v-else-if="AIMessage.isInstance(msg)">
                <ThinkingBubble :is-streaming="isStreamingReasoning(msg)" class="mb-0.5">
                    <Markdown :content="getReasoningContent(msg)" />
                </ThinkingBubble>

                <AIBubble v-if="msg.text">
                    <Markdown :content="msg.text" />
                </AIBubble>

                <div v-for="tc in msg.tool_calls" :key="tc.id">
                    <ToolCard :tool-call="toolCallsMap.get(tc.id)" />
                </div>
            </template>

            <!-- 操作栏 -->
            <div v-if="HumanMessage.isInstance(msg) || (!isLoading && aiGroupEndIndices.has(i))"
                class="flex items-center gap-1"
                :class="HumanMessage.isInstance(msg) ? 'justify-end' : ''">

                <!-- Human: copy + edit -->
                <template v-if="HumanMessage.isInstance(msg)">
                    <button type="button" @click="editHumanMsg(msg.id!)"
                        class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-text-tertiary hover:text-text hover:bg-surface-tertiary transition-colors cursor-pointer">
                        <EditSharp class="w-3 h-3" />
                        编辑
                    </button>
                    <button type="button" @click="copyHumanMsg(msg)"
                        class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] transition-colors cursor-pointer"
                        :class="copiedMsgId === msg.id ? 'text-green-500' : 'text-text-tertiary hover:text-text hover:bg-surface-tertiary'">
                        <DoneSharp v-if="copiedMsgId === msg.id" class="w-3 h-3" />
                        <ContentCopySharp v-else class="w-3 h-3" />
                        {{ copiedMsgId === msg.id ? '已复制' : '复制' }}
                    </button>
                </template>

                <!-- AI: regenerate + branch -->
                <template v-else>
                    <button type="button" @click="handleRegenerateFromIndex(i)"
                        class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-text-tertiary hover:text-text hover:bg-surface-tertiary transition-colors cursor-pointer">
                        <ReplaySharp class="w-3 h-3" />
                        重新生成
                    </button>

                    <!-- 分支 -->
                    <template v-if="getMessagesMetadata(msg, i)?.branchOptions as any">
                        <div class="inline-flex items-center gap-0.5 text-[10px] text-text-tertiary">
                            <button @click="handlePrevBranch(msg, i)"
                                :disabled="getMessagesMetadata(msg, i)?.branchOptions?.indexOf(getMessagesMetadata(msg, i)?.branch ?? '') === 0"
                                class="p-0.5 rounded hover:text-text hover:bg-surface-tertiary disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer">
                                <ArrowBackSharp class="w-3 h-3" />
                            </button>
                            <span class="min-w-8 text-center tabular-nums">
                                {{ (getMessagesMetadata(msg, i)?.branchOptions?.indexOf(getMessagesMetadata(msg, i)?.branch
                                    ?? '') ?? 0) + 1 }}/{{ getMessagesMetadata(msg, i)?.branchOptions?.length }}
                            </span>
                            <button @click="handleNextBranch(msg, i)"
                                :disabled="(getMessagesMetadata(msg, i)?.branchOptions?.indexOf(getMessagesMetadata(msg, i)?.branch ?? '') ?? 0) >= (getMessagesMetadata(msg, i)?.branchOptions?.length ?? 1) - 1"
                                class="p-0.5 rounded hover:text-text hover:bg-surface-tertiary disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer">
                                <ArrowForwardSharp class="w-3 h-3" />
                            </button>
                        </div>
                    </template>
                </template>
            </div>
        </template>

        <TypingIndicator v-if="isLoading" />
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
import { ArrowBackSharp, ArrowForwardSharp, ReplaySharp, EditSharp, ContentCopySharp, DoneSharp } from "@vicons/material";
import TypingIndicator from "./TypingIndicator.vue";

const context = useStreamContext();
const { submit, messages, isLoading, getMessagesMetadata, setBranch } = context

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

// 记录每个 AI 消息分组最后一条消息的索引
// 消息序列示例：[human, ai, ai, ai, human, ai, ai] → indices = {3, 6}
// 用于在每组 AI 消息结束后插入操作栏等额外内容
const aiGroupEndIndices = computed(() => {
    const indices = new Set<number>()
    const msgs = messages.value
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
        isLoading.value &&
        messages.value[messages.value.length - 1]?.id === msg.id
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
        { messages: [{ ...msg, content: text }] },
        { checkpoint }
    );
}

function handlePrevBranch(msg: any, i: number) {
    const meta = getMessagesMetadata(msg, i);
    if (!meta?.branchOptions || !meta.branch) return;
    const prev = meta.branchOptions[meta.branchOptions.indexOf(meta.branch) - 1];
    if (prev) setBranch(prev);
}

function handleNextBranch(msg: any, i: number) {
    const meta = getMessagesMetadata(msg, i);
    if (!meta?.branchOptions || !meta.branch) return;
    const next = meta.branchOptions[meta.branchOptions.indexOf(meta.branch) + 1];
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
    if (!firstMsg) return;
    const metadata = getMessagesMetadata(firstMsg);
    if (!metadata) return;
    const checkpoint = metadata.firstSeenState?.parent_checkpoint;
    if (!checkpoint) return;
    submit(undefined, { checkpoint });

}
</script>