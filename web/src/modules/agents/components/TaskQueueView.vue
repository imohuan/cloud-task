<template>
  <div class="font-sans text-[12px] w-full">
    <!-- Empty state -->
    <div v-if="queue.size === 0" class="text-zinc-400 text-[11px] italic">
      暂无排队任务
    </div>

    <template v-else>
      <!-- Header -->
      <div class="flex items-center justify-between mb-2">
        <button
          class="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-700 transition-colors"
          @click="collapsed = !collapsed"
        >
          <!-- Queue / X icon cross-fade -->
          <svg class="w-3.5 h-3.5 overflow-visible" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8">
            <!-- Queue lines -->
            <g class="qi-state" :class="{ hidden: collapsed }">
              <line x1="2" y1="4" x2="14" y2="4" stroke-linecap="round" />
              <line x1="2" y1="8" x2="12" y2="8" stroke-linecap="round" />
              <line x1="2" y1="12" x2="8"  y2="12" stroke-linecap="round" />
            </g>
            <!-- X lines -->
            <g class="qi-state" :class="{ hidden: !collapsed }">
              <line x1="3" y1="3" x2="13" y2="13" stroke-linecap="round" />
              <line x1="13" y1="3" x2="3"  y2="13" stroke-linecap="round" />
            </g>
          </svg>
          <span>排队中</span>
          <span class="rounded-full bg-zinc-200 text-zinc-600 text-[10px] px-1.5 py-px font-medium leading-none">
            {{ queue.size }}
          </span>
        </button>
        <button
          v-if="!collapsed"
          class="text-[11px] text-red-400 hover:text-red-600 transition-colors flex items-center gap-1"
          :disabled="clearing"
          @click="clearAll"
        >
          <svg class="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M3 4h10M5 4V3h6v1M6 7v5M10 7v5M4 4l1 9h6l1-9" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          {{ clearing ? "清除中…" : "全部取消" }}
        </button>
      </div>

      <!-- Entries -->
      <div v-if="!collapsed" class="flex flex-col gap-1.5">
        <div
          v-for="entry in queue.entries"
          :key="entry.id"
          class="flex items-start gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2"
        >
          <!-- Waiting indicator -->
          <span class="mt-0.5 w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 animate-pulse" />

          <!-- Content -->
          <div class="flex-1 min-w-0">
            <div class="text-zinc-700 truncate leading-5">{{ extractPreview(entry.values) }}</div>
            <div class="text-zinc-400 text-[10px] mt-0.5">{{ formatTime(entry.createdAt) }}</div>
          </div>

          <!-- Cancel -->
          <button
            class="shrink-0 mt-0.5 text-zinc-400 hover:text-red-500 transition-colors"
            :disabled="cancelling.has(entry.id)"
            :title="'取消 ' + entry.id"
            @click="cancelEntry(entry.id)"
          >
            <svg v-if="!cancelling.has(entry.id)" class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 4l8 8M12 4l-8 8" stroke-linecap="round" />
            </svg>
            <svg v-else class="w-3.5 h-3.5 animate-spin text-zinc-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke-linecap="round" />
            </svg>
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";

export interface QueueEntry {
  id: string;
  values: Record<string, any>;
  options: Record<string, any>;
  createdAt: string;
}

export interface Queue {
  entries: QueueEntry[];
  size: number;
  cancel: (id: string) => Promise<void>;
  clear: () => Promise<void>;
}

const props = defineProps<{ queue: Queue }>();

const cancelling = ref<Set<string>>(new Set());
const clearing = ref(false);
const collapsed = ref(false);

async function cancelEntry(id: string) {
  cancelling.value = new Set([...cancelling.value, id]);
  try {
    await props.queue.cancel(id);
  } finally {
    const next = new Set(cancelling.value);
    next.delete(id);
    cancelling.value = next;
  }
}

async function clearAll() {
  clearing.value = true;
  try {
    await props.queue.clear();
  } finally {
    clearing.value = false;
  }
}

function extractPreview(values: Record<string, any>): string {
  // Try common message field patterns
  const msg =
    values?.messages?.at?.(-1)?.content ??
    values?.input ??
    values?.message ??
    values?.query ??
    values?.text;
  if (typeof msg === "string") return msg;
  if (Array.isArray(msg)) return msg.map((m) => m?.text ?? m?.content ?? "").join(" ");
  return JSON.stringify(values).slice(0, 80);
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const diff = Math.floor((now - d.getTime()) / 1000);
  if (diff < 60) return `${diff}秒前`;
  if (diff < 3600) return `${Math.floor(diff / 60)}分钟前`;
  return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}
</script>

<style scoped>
.qi-state {
  transition: opacity 0.2s ease, transform 0.2s ease;
  transform-origin: 8px 8px;
}
.qi-state.hidden {
  opacity: 0;
  transform: scale(0.7);
  pointer-events: none;
  position: absolute;
}
</style>
