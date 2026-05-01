<template>
    <div class="h-full flex flex-col gap-2">
        <template v-for="(msg, i) in messages" :key="msg.id ?? i">
            <!-- <pre class="p-4 border rounded-3xl"> {{ msg }} </pre> -->
            <HumanBubble v-if="HumanMessage.isInstance(msg)" :content="msg.text">
                <Markdown :content="msg.text" />
            </HumanBubble>

            <div v-else-if="AIMessage.isInstance(msg)" class="space-y-2">
                <ThinkingBubble :is-streaming="isStreamingReasoning(msg)">
                    <Markdown :content="getReasoningContent(msg)" />
                </ThinkingBubble>

                <AIBubble v-if="msg.text">
                    <Markdown :content="msg.text" />
                </AIBubble>

                <div v-for="tc in msg.tool_calls" :key="tc.id" class="pl-9 max-w-[80%]">
                    <!-- <ToolCard :tool-call="{tc}" /> -->
                    <pre>{{ tc }}</pre>
                </div>
            </div>
        </template>
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

// import { HumanMessage } from "langchain"
const { messages, isLoading } = useStreamContext();

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
</script>