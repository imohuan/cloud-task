import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { Client } from "@langchain/langgraph-sdk";
import type { Conversation } from "@/layouts/SidebarAgentsSection.vue";
import { CHAT_API_URL } from "@/config";

const client = new Client({ apiUrl: CHAT_API_URL });

function formatThreadTitle(thread: { thread_id: string; created_at?: string; metadata?: Record<string, any> | null }): string {
  if (thread.metadata?.title) return thread.metadata.title;
  if (!thread.created_at) return thread.thread_id.slice(0, 8);
  const d = new Date(thread.created_at);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const useAgentsStore = defineStore("agents", () => {
  const currentConversationId = ref<string | undefined>(undefined);
  const threads = ref<{ thread_id: string; created_at?: string; metadata?: Record<string, any> | null }[]>([]);
  const loading = ref(false);

  const conversations = computed<Conversation[]>(() =>
    threads.value.map((t) => ({ id: t.thread_id, title: formatThreadTitle(t) })),
  );

  async function fetchThreads() {
    loading.value = true;
    try {
      const result = await client.threads.search({ limit: 10 });
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
