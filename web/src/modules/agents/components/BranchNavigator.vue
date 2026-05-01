<template>
    <div v-if="branchOptions.length > 1" class="inline-flex items-center gap-0.5 text-[10px] text-gray-400">
        <button @click="emit('prev')"
            :disabled="branchIndex <= 0"
            class="p-0.5 rounded hover:text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer">
            <ArrowBackSharp class="w-3 h-3" />
        </button>
        <span class="min-w-8 text-center tabular-nums">
            {{ branchIndex + 1 }}/{{ branchOptions.length }}
        </span>
        <button @click="emit('next')"
            :disabled="branchIndex >= branchOptions.length - 1"
            class="p-0.5 rounded hover:text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer">
            <ArrowForwardSharp class="w-3 h-3" />
        </button>
    </div>
</template>

<script setup lang="ts">
import { ArrowBackSharp, ArrowForwardSharp } from "@vicons/material";

const props = defineProps<{
    branchOptions: string[];
    branchIndex: number;
}>();

const emit = defineEmits<{
    prev: [];
    next: [];
}>();
</script>
