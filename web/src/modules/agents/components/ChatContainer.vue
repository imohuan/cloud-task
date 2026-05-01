<template>
    <div class="w-full max-w-xl m-auto h-full flex flex-col gap-2">
        <MessageList />
        <ChatInput :isLoading="isLoading" @send="onSend" />
    </div>
</template>

<script setup lang="ts">
import ChatInput from "./ChatInput.vue";
import { useStreamContext } from "@langchain/vue"
import { HumanMessage } from "langchain"
import MessageList from "./MessageList.vue"

const { submit, isLoading } = useStreamContext();

function onSend(text: string, images: any[]) {
    // console.log([new HumanMessage(text), ...images.map((img) => new HumanMessage(img.url))]);
    submit({ messages: [new HumanMessage(text), ...images.map((img) => new HumanMessage(img.url))] });
}
</script>   