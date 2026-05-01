<template>
    <div class="h-full ">
        <div v-for="(msg, i) in messages" :key="msg.id ?? i">
            {{ msg.content }}
        </div>
    </div>
</template>

<script setup lang="ts">
import { useStreamContext } from "@langchain/vue"
// import { HumanMessage } from "langchain"

const { messages } = useStreamContext();

</script>