import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { Conversation } from "@/layouts/SidebarAgentsSection.vue";
import { agentApi, type ThreadItem } from "@/api";

function formatThreadTitle(thread: ThreadItem): string {
  if (!thread.created_at) return thread.thread_id.slice(0, 8);
  const d = new Date(thread.created_at);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const useAgentsStore = defineStore("agents", () => {
  const currentConversationId = ref<string | undefined>(undefined);
  const threads = ref<ThreadItem[]>([]);
  const loading = ref(false);

  const conversations = computed<Conversation[]>(() =>
    threads.value.map((t) => ({ id: t.thread_id, title: formatThreadTitle(t) })),
  );

  async function fetchThreads() {
    loading.value = true;
    try {
      const result = await agentApi.searchThreads();
      console.log("[useAgentsStore] fetchThreads result:", result);
      threads.value = result;
    } catch (e) {
      console.error("[useAgentsStore] fetchThreads error:", e);
    } finally {
      loading.value = false;
    }
  }

  function selectConversation(id: string | undefined) {
    currentConversationId.value = id;
  }

  function removeThread(threadId: string) {
    threads.value = threads.value.filter((t) => t.thread_id !== threadId);
    if (currentConversationId.value === threadId) {
      currentConversationId.value = undefined;
    }
  }

  return {
    conversations,
    currentConversationId,
    threads,
    loading,
    fetchThreads,
    selectConversation,
    removeThread,
  };
});
