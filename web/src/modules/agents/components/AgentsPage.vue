<template>
  <div class="flex h-full flex-col bg-slate-50">
    <!-- Messages area -->
    <div ref="scrollRef" class="flex-1 overflow-y-auto px-4 py-6">
      <!-- Empty state -->
      <div
        v-if="!stream.messages.value.length"
        class="flex h-full flex-col items-center justify-center text-slate-400"
      >
        <i class="fa-solid fa-robot mb-3 text-5xl opacity-20"></i>
        <p class="text-sm">发送消息开始对话</p>
      </div>

      <!-- Message list -->
      <div v-else class="mx-auto max-w-3xl space-y-4">
        <template v-for="msg in stream.messages.value" :key="msg.id">
          <!-- HumanMessage -->
          <div v-if="msg.getType() === 'human'" class="flex justify-end">
            <div
              class="max-w-[75%] rounded-2xl rounded-tr-sm bg-blue-600 px-4 py-2.5 text-sm text-white shadow-sm"
            >
              <p class="whitespace-pre-wrap">{{ getContent(msg) }}</p>
            </div>
          </div>

          <!-- AIMessage -->
          <div v-else-if="msg.getType() === 'ai'" class="flex justify-start gap-2.5">
            <div
              class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-600"
            >
              <i class="fa-solid fa-robot text-xs"></i>
            </div>
            <div class="max-w-[75%] space-y-2">
              <!-- Text content -->
              <div
                v-if="getContent(msg)"
                class="rounded-2xl rounded-tl-sm bg-white px-4 py-2.5 text-sm text-slate-800 shadow-sm ring-1 ring-slate-100"
              >
                <p class="whitespace-pre-wrap">{{ getContent(msg) }}</p>
              </div>
              <!-- Tool calls for this message -->
              <div
                v-for="tc in getMessageToolCalls(msg)"
                :key="tc.call.id"
                class="rounded-xl border bg-white shadow-sm"
              >
                <!-- Tool header -->
                <div class="flex items-center gap-2 border-b px-3 py-2">
                  <i
                    :class="toolIcon(tc.call.name)"
                    class="text-xs text-slate-500"
                  ></i>
                  <span class="text-xs font-medium text-slate-600">{{ tc.call.name }}</span>
                  <span
                    :class="stateClass(tc.state)"
                    class="ml-auto rounded-full px-2 py-0.5 text-[10px] font-medium"
                  >{{ stateLabel(tc.state) }}</span>
                </div>
                <!-- Args -->
                <div class="px-3 py-2">
                  <p class="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    参数
                  </p>
                  <pre class="overflow-x-auto rounded bg-slate-50 p-2 text-[11px] text-slate-700">{{ JSON.stringify(tc.call.args, null, 2) }}</pre>
                </div>
                <!-- Result -->
                <div v-if="tc.result" class="border-t px-3 py-2">
                  <p class="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    结果
                  </p>
                  <pre class="overflow-x-auto rounded bg-slate-50 p-2 text-[11px] text-slate-700 whitespace-pre-wrap">{{ getContent(tc.result) }}</pre>
                </div>
                <!-- Pending -->
                <div v-else-if="tc.state === 'pending'" class="border-t px-3 py-2">
                  <div class="flex items-center gap-2 text-xs text-slate-400">
                    <i class="fa-solid fa-circle-notch animate-spin"></i>
                    <span>执行中...</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>

        <!-- Streaming indicator -->
        <div v-if="stream.isLoading.value" class="flex justify-start gap-2.5">
          <div
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-600"
          >
            <i class="fa-solid fa-robot text-xs"></i>
          </div>
          <div class="flex items-center gap-1.5 rounded-2xl rounded-tl-sm bg-white px-4 py-3 shadow-sm ring-1 ring-slate-100">
            <span class="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]"></span>
            <span class="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]"></span>
            <span class="h-2 w-2 animate-bounce rounded-full bg-slate-400"></span>
          </div>
        </div>
      </div>
    </div>

    <!-- Input area -->
    <div class="border-t bg-white px-4 py-3">
      <div class="mx-auto max-w-3xl">
        <div class="flex items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100">
          <textarea
            ref="inputRef"
            v-model="inputText"
            rows="1"
            placeholder="输入消息..."
            class="max-h-40 flex-1 resize-none bg-transparent text-sm text-slate-800 placeholder-slate-400 outline-none"
            @keydown.enter.exact.prevent="submit"
            @input="autoResize"
          ></textarea>
          <div class="flex shrink-0 items-center gap-1.5">
            <button
              v-if="stream.isLoading.value"
              class="flex h-8 w-8 items-center justify-center rounded-xl bg-red-100 text-red-500 transition hover:bg-red-200"
              title="停止"
              @click="stream.stop()"
            >
              <i class="fa-solid fa-stop text-xs"></i>
            </button>
            <button
              :disabled="!inputText.trim() || stream.isLoading.value"
              class="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
              title="发送 (Enter)"
              @click="submit"
            >
              <i class="fa-solid fa-paper-plane text-xs"></i>
            </button>
          </div>
        </div>
        <p class="mt-1.5 text-center text-[11px] text-slate-400">
          Enter 发送 · Shift+Enter 换行
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick, watch } from "vue";
import { useStream } from "@langchain/vue";
import { HumanMessage } from "langchain";
import type { BaseMessage } from "@langchain/core/messages";

const stream = useStream({
  assistantId: "tool-calling",
});

const inputText = ref("");
const scrollRef = ref<HTMLElement | null>(null);
const inputRef = ref<HTMLTextAreaElement | null>(null);

function getContent(msg: BaseMessage | { content: unknown }): string {
  const c = msg.content;
  if (typeof c === "string") return c;
  if (Array.isArray(c)) {
    return c
      .map((part) => (typeof part === "string" ? part : (part as { text?: string }).text ?? ""))
      .join("");
  }
  return "";
}

function getMessageToolCalls(msg: BaseMessage) {
  return (stream.toolCalls.value ?? []).filter((tc) =>
    (msg as { tool_calls?: { id: string }[] }).tool_calls?.some((t) => t.id === tc.call.id),
  );
}

function toolIcon(name: string): string {
  const map: Record<string, string> = {
    get_weather: "fa-solid fa-cloud-sun",
    calculator: "fa-solid fa-calculator",
    search_web: "fa-solid fa-magnifying-glass",
    tavily_search_results_json: "fa-solid fa-magnifying-glass",
  };
  return map[name] ?? "fa-solid fa-wrench";
}

function stateClass(state: string): string {
  return {
    pending: "bg-amber-100 text-amber-700",
    completed: "bg-emerald-100 text-emerald-700",
    error: "bg-red-100 text-red-700",
  }[state] ?? "bg-slate-100 text-slate-600";
}

function stateLabel(state: string): string {
  return { pending: "执行中", completed: "完成", error: "失败" }[state] ?? state;
}

function submit() {
  const text = inputText.value.trim();
  if (!text || stream.isLoading.value) return;
  stream.submit({ messages: [new HumanMessage(text)] });
  inputText.value = "";
  nextTick(() => {
    if (inputRef.value) {
      inputRef.value.style.height = "auto";
    }
  });
}

function autoResize(e: Event) {
  const el = e.target as HTMLTextAreaElement;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

function scrollToBottom() {
  if (scrollRef.value) {
    scrollRef.value.scrollTop = scrollRef.value.scrollHeight;
  }
}

watch(
  () => stream.messages.value.length,
  () => nextTick(scrollToBottom),
);

watch(
  () => stream.isLoading.value,
  () => nextTick(scrollToBottom),
);
</script>