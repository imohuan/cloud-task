<template>
  <div class="mb-4 select-none">
    <div v-show="!isCollapsed" class="group mb-2 flex items-center justify-between px-3 py-1">
      <button class="flex flex-1 items-center text-left" @click.stop="isExpanded = !isExpanded">
        <span class="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Agents</span>
      </button>
      <div class="relative flex h-5 w-5 items-center justify-center">
        <button
          :class="['absolute flex h-5 w-5 items-center justify-center rounded text-slate-400 transition-opacity duration-150', isMobile ? 'opacity-0 pointer-events-none' : 'group-hover:opacity-0 group-hover:pointer-events-none']"
          @click.stop="isExpanded = !isExpanded">
          <ChevronRightFilled class="h-3.5 w-3.5 transition-transform duration-200"
            :class="{ 'rotate-90': isExpanded }" />
        </button>
        <button
          :class="['absolute flex h-5 w-5 items-center justify-center rounded text-slate-400 transition-opacity duration-150 hover:bg-slate-100 hover:text-blue-600', isMobile ? '' : 'opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto']"
          title="新建对话" @click.stop="emit('selectConversation', null)">
          <AddFilled class="h-3.5 w-3.5" />
        </button>
      </div>
    </div>

    <div v-show="!isCollapsed && isExpanded" class="flex flex-col gap-0.5">
      <SwipeListItem
        v-for="conv in visibleConversations.slice(0, 5)"
        :key="conv.id"
        class="rounded-lg"
        @delete="confirmDelete(conv)"
      >
        <div
          class="group flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-[13px]"
          :class="currentView === 'agents' && currentConversationId === conv.id
            ? 'bg-blue-50 font-semibold text-blue-700'
            : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'"
          @click.stop="emit('selectConversation', conv)"
        >
          <ChatBubbleFilled class="h-4 w-4 shrink-0 opacity-70" />
          <span class="min-w-0 flex-1 truncate">{{ conv.title }}</span>
          <button
            class="flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-300 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
            title="删除对话" @click.stop="confirmDelete(conv)">
            <DeleteFilled class="h-3 w-3" />
          </button>
        </div>
      </SwipeListItem>

      <div v-if="conversations.length === 0" class="px-3 py-2 text-[12px] text-slate-400">
        暂无对话历史
      </div>

      <button v-if="!showAll && conversations.length > PAGE_SIZE"
        class="mt-1 w-full rounded-lg px-3 py-1.5 text-left text-[12px] text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors"
        @click.stop="showAll = true">
        显示全部 ({{ conversations.length }})
      </button>
    </div>
  </div>

  <ConfirmDialog v-model="deleteDialog.visible" :title="deleteDialog.title" :content="deleteDialog.content"
    type="danger" confirm-text="删除" @confirm="handleDeleteConfirm" @cancel="handleDeleteCancel" />
</template>

<script setup lang="ts">
import { ref, computed, reactive } from "vue";
import { ChatBubbleFilled, AddFilled, ChevronRightFilled, DeleteFilled } from "@vicons/material";
import ConfirmDialog from "@/components/ConfirmDialog.vue";
import SwipeListItem from "@/components/SwipeListItem.vue";
import { useAppStore } from "@/stores/useAppStore";

export interface Conversation {
  id: string;
  title: string;
}

const props = withDefaults(
  defineProps<{
    isCollapsed?: boolean;
    currentView?: string;
    conversations?: Conversation[];
    currentConversationId?: string | null;
  }>(),
  { conversations: () => [] },
);

const emit = defineEmits<{
  (e: "navigate"): void;
  (e: "selectConversation", conv: Conversation | null): void;
  (e: "deleteConversation", id: string): void;
}>();

const { isMobile } = useAppStore();
const PAGE_SIZE = 10;
const showAll = ref(false);
const isExpanded = ref(true);

const convToDelete = ref<Conversation | null>(null);
const deleteDialog = reactive({
  visible: false,
  title: "删除对话",
  content: "",
});

const confirmDelete = (conv: Conversation) => {
  convToDelete.value = conv;
  deleteDialog.title = "删除对话";
  deleteDialog.content = `确定要删除对话 "${conv.title}" 吗？此操作不可恢复。`;
  deleteDialog.visible = true;
};

const handleDeleteConfirm = () => {
  if (convToDelete.value) {
    emit("deleteConversation", convToDelete.value.id);
    convToDelete.value = null;
  }
  deleteDialog.visible = false;
};

const handleDeleteCancel = () => {
  convToDelete.value = null;
  deleteDialog.visible = false;
};

const visibleConversations = computed(() =>
  showAll.value ? props.conversations : props.conversations.slice(0, PAGE_SIZE),
);
</script>
