<script setup lang="ts">
import { ChatBubbleOutlineSharp } from '@vicons/material'
</script>

<template>
  <div class="flex-1 flex flex-col items-center justify-center gap-3 text-center select-none py-12">
    <div class="w-12 h-12 rounded-2xl bg-surface-secondary flex items-center justify-center">
      <ChatBubbleOutlineSharp class="w-6 h-6 text-text-tertiary" />
    </div>
    <div>
      <p class="text-sm font-medium text-text-secondary">开始对话</p>
      <p class="text-xs text-text-tertiary mt-0.5">发送消息，AI 将为你解答</p>
    </div>
  </div>
</template>
