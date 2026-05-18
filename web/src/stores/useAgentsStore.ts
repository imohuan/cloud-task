import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { Client } from "@langchain/langgraph-sdk";
import type { Conversation } from "@/layouts/SidebarAgentsSection.vue";
import { CHAT_API_URL } from "@/config";

const client = new Client({ apiUrl: CHAT_API_URL });

type Thread = { thread_id: string; created_at?: string; metadata?: Record<string, any> | null };
type Assistant = { id: string; name: string; description?: string };

function extractArrayFromResult<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result;
  if (result && typeof result === "object") {
    const data = (result as Record<string, unknown>).data;
    if (Array.isArray(data)) return data as T[];
  }
  return [];
}

function formatThreadTitle(thread: { thread_id: string; created_at?: string; metadata?: Record<string, any> | null }): string {
  if (thread.metadata?.title) return thread.metadata.title;
  if (!thread.created_at) return thread.thread_id.slice(0, 8);
  const d = new Date(thread.created_at);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const GRAPH_ID_NAMES: Record<string, string> = {
  base_agent: "基础助手",
  flow_agent: "流程助手",
  deepsagent: "深度搜索",
};

export const useAgentsStore = defineStore("agents", () => {
  const currentConversationId = ref<string | null | undefined>(undefined);
  const assistantId = ref<string>("")
  const assistants = ref<Assistant[]>([]);
  const threads = ref<Thread[]>([]);
  const loading = ref(false);

  const conversations = computed<Conversation[]>(() =>
    threads.value.map((t) => ({ id: t.thread_id, title: formatThreadTitle(t) })),
  );

  async function refreshThreads() {
    try {
      const result = await client.threads.search({ limit: 10, offset: 0 });
      const resultList = extractArrayFromResult<Thread>(result);
      const existingIds = new Set(threads.value.map((t) => t.thread_id));
      for (const t of resultList) {
        if (!existingIds.has(t.thread_id)) {
          threads.value.push(t);
          existingIds.add(t.thread_id);
        }
      }
      if (threads.value.length > 10) {
        threads.value = threads.value.slice(0, 10);
      }
    } catch (e) {
      console.error("[useAgentsStore] refreshThreads error:", e);
    }
  }

  async function fetchThreads() {
    loading.value = true;
    try {
      const result = await client.threads.search({ limit: 10, offset: 0 });
      console.log("[useAgentsStore] fetchThreads result:", result);
      threads.value = extractArrayFromResult<Thread>(result);
    } catch (e) {
      console.error("[useAgentsStore] fetchThreads error:", e);
      threads.value = [];
    } finally {
      loading.value = false;
    }
  }

  async function fetchThread(threadId: string) {
    try {
      return await client.threads.get(threadId);
    } catch (e) {
      console.error("[useAgentsStore] deleteThread error:", e);
      return null
    }
  }

  async function deleteThread(threadId: string) {
    try {
      await client.threads.delete(threadId);
      removeThread(threadId);
      refreshThreads();
    } catch (e) {
      console.error("[useAgentsStore] deleteThread error:", e);
    }
  }

  async function fetchAssistants() {
    try {
      loading.value = true;
      const result = await client.assistants.search();
      console.log("[useAgentsStore] fetchAssistants result:", result);
      const assistantList = extractArrayFromResult<any>(result);
      assistants.value = assistantList
        .filter((f) => f.graph_id !== "tool_calling")
        .map((a) => ({ id: a.graph_id, name: GRAPH_ID_NAMES[a.graph_id] ?? a.name, description: a.description }));
      assistantId.value = assistants.value[0]?.id || "base_agent";
    } catch (e) {
      console.error("[useAgentsStore] fetchAssistants error:", e);
      assistants.value = [];
      assistantId.value = "base_agent";
    } finally {
      loading.value = false;
    }
  }

  function selectConversation(id: string | null | undefined) {
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
    assistantId,
    loading,
    threads,
    assistants,
    fetchThreads,
    refreshThreads,
    fetchAssistants,
    selectConversation,
    fetchThread,
    removeThread,
    deleteThread,
  };
});
