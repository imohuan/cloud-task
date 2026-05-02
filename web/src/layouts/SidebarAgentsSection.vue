<template>
  <div class="mb-4 select-none">
    <div
      v-show="!isCollapsed"
      class="group mb-2 flex items-center justify-between px-3 py-1"
    >
      <span class="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Agents</span>
      <button
        class="flex h-5 w-5 items-center justify-center rounded text-slate-400 transition-colors hover:bg-slate-100 hover:text-blue-600"
        title="新建对话"
        @click.stop
      >
        <AddFilled class="h-3.5 w-3.5" />
      </button>
    </div>

    <div v-show="!isCollapsed" class="flex flex-col gap-0.5">
      <div
        v-for="conv in visibleConversations"
        :key="conv.id"
        class="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-[13px] hover:bg-slate-50"
        :class="
          currentConversationId === conv.id
            ? 'bg-blue-50 font-semibold text-blue-700'
            : 'text-slate-500 hover:text-slate-900'
        "
        @click.stop="emit('selectConversation', conv)"
      >
        <ChatBubbleFilled class="h-4 w-4 shrink-0 opacity-70" />
        <span class="truncate">{{ conv.title }}</span>
      </div>

      <div v-if="conversations.length === 0" class="px-3 py-2 text-[12px] text-slate-400">
        暂无对话历史
      </div>

      <button
        v-if="!showAll && conversations.length > PAGE_SIZE"
        class="mt-1 w-full rounded-lg px-3 py-1.5 text-left text-[12px] text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors"
        @click.stop="showAll = true"
      >
        显示全部 ({{ conversations.length }})
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { ChatBubbleFilled, AddFilled } from "@vicons/material";

export interface Conversation {
  id: string;
  title: string;
}

const props = withDefaults(
  defineProps<{
    isCollapsed?: boolean;
    currentView?: string;
    conversations?: Conversation[];
    currentConversationId?: string;
  }>(),
  { conversations: () => [] },
);

const emit = defineEmits<{
  (e: "navigate"): void;
  (e: "selectConversation", conv: Conversation): void;
}>();

const PAGE_SIZE = 10;
const showAll = ref(false);

const visibleConversations = computed(() =>
  showAll.value ? props.conversations : props.conversations.slice(0, PAGE_SIZE),
);
</script>
