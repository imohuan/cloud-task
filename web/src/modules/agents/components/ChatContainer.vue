<template>

</template>

<script setup lang="ts">
import { provideStream } from "@langchain/vue";
provideStream({ assistantId: "tool-calling", });
</script>