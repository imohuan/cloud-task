<template>
  <div class="rounded-lg border text-sm font-mono w-full overflow-hidden" :class="wrapperClass">
    <!-- Header (click to toggle) -->
    <div
      class="flex items-center gap-2 px-3 py-2 cursor-pointer select-none"
      :class="[headerClass, collapsed ? '' : 'border-b']"
      @click="collapsed = !collapsed"
    >
      <span v-if="toolCall.state === 'pending'" class="inline-block w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
      <span v-else-if="toolCall.state === 'completed'" class="text-green-500">✓</span>
      <span v-else-if="toolCall.state === 'error'" class="text-red-500">✕</span>

      <span class="font-semibold tracking-wide">{{ toolCall.call.name }}</span>
      <span class="text-xs opacity-40 font-sans">{{ toolCall.call.id }}</span>

      <svg
        class="ml-auto w-3.5 h-3.5 opacity-40 transition-transform duration-200"
        :class="collapsed ? '' : 'rotate-180'"
        viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"
      >
        <polyline points="4,6 8,10 12,6" />
      </svg>
    </div>

    <!-- Body -->
    <template v-if="!collapsed">
      <!-- Args -->
      <div class="px-3 py-2 border-b bg-zinc-50/60">
        <div class="text-xs opacity-50 font-sans mb-1 uppercase tracking-widest">args</div>
        <pre class="whitespace-pre-wrap break-all text-xs">{{ formatJson(toolCall.call.args) }}</pre>
      </div>

      <!-- Result / Loading / Error -->
      <div class="px-3 py-2">
        <template v-if="toolCall.state === 'pending'">
          <div class="flex items-center gap-2 text-xs font-sans opacity-60">
            <span class="inline-block w-2 h-2 rounded-full bg-current animate-pulse" />
            <span>Running…</span>
          </div>
        </template>

        <template v-else-if="toolCall.state === 'error'">
          <div class="text-xs font-sans mb-1 uppercase tracking-widest opacity-50">error</div>
          <pre class="whitespace-pre-wrap break-all text-xs text-red-600">{{ formatContent(toolCall.result?.content) }}</pre>
        </template>

        <template v-else>
          <div class="text-xs font-sans mb-1 uppercase tracking-widest opacity-50">result</div>
          <pre class="whitespace-pre-wrap break-all text-xs">{{ formatContent(toolCall.result?.content) }}</pre>
        </template>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

interface ToolCallWithResult {
  call: { id: string; name: string; args: any };
  result?: { content: any };
  state: "pending" | "completed" | "error";
}

const props = defineProps<{ toolCall: ToolCallWithResult }>();

const collapsed = ref(true);

const wrapperClass = computed(() => ({
  "bg-white border-zinc-200 text-zinc-800": props.toolCall.state !== "error",
  "bg-red-50 border-red-300 text-red-800": props.toolCall.state === "error",
}));

const headerClass = computed(() => ({
  "border-zinc-200 bg-zinc-50": props.toolCall.state !== "error",
  "border-red-300 bg-red-100": props.toolCall.state === "error",
}));

function formatJson(val: any): string {
  try {
    return JSON.stringify(val, null, 2);
  } catch {
    return String(val);
  }
}

function formatContent(content: any): string {
  if (content === undefined || content === null) return "—";
  if (typeof content === "string") {
    try {
      return JSON.stringify(JSON.parse(content), null, 2);
    } catch {
      return content;
    }
  }
  return formatJson(content);
}
</script>
