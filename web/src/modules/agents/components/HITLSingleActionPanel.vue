<template>
  <div class="px-3 py-3 space-y-3">
    <!-- Action header -->
    <div class="flex items-start gap-2">
      <span v-if="index !== undefined"
        class="mt-0.5 shrink-0 w-5 h-5 rounded-full bg-amber-200 text-amber-700 text-[10px] font-semibold font-sans flex items-center justify-center">
        {{ index + 1 }}
      </span>
      <div class="flex-1 min-w-0">
        <div class="font-mono font-semibold text-amber-900 truncate">{{ action.action }}</div>
        <div v-if="action.description" class="text-xs text-amber-700 font-sans mt-0.5">{{ action.description }}</div>
      </div>
      <!-- Decided badge -->
      <span v-if="decided" class="shrink-0 text-[10px] font-sans font-semibold uppercase tracking-widest px-1.5 py-0.5 rounded"
        :class="decidedClass">{{ decidedLabel }}</span>
    </div>

    <!-- Args preview -->
    <div class="rounded border border-amber-200 bg-white overflow-hidden">
      <template v-if="mode === 'edit'">
        <textarea
          v-model="editedJson"
          rows="6"
          class="w-full px-3 py-2 font-mono text-xs text-zinc-800 resize-y outline-none focus:ring-1 focus:ring-amber-400 rounded"
          :class="jsonError ? 'ring-1 ring-red-400' : ''"
          spellcheck="false"
        />
        <div v-if="jsonError" class="px-3 pb-2 text-[11px] text-red-500 font-sans">JSON 格式错误</div>
      </template>
      <pre v-else class="px-3 py-2 font-mono text-xs text-zinc-700 whitespace-pre-wrap break-all">{{ argsText }}</pre>
    </div>

    <!-- Reject / Respond textareas -->
    <textarea
      v-if="mode === 'reject'"
      v-model="rejectReason"
      rows="3"
      placeholder="拒绝理由（可选）…"
      class="w-full rounded border border-amber-200 bg-white px-3 py-2 text-xs font-sans text-zinc-700 resize-none outline-none focus:ring-1 focus:ring-amber-400"
    />
    <textarea
      v-if="mode === 'respond'"
      v-model="respondMessage"
      rows="3"
      placeholder="输入你的回复…"
      class="w-full rounded border border-amber-200 bg-white px-3 py-2 text-xs font-sans text-zinc-700 resize-none outline-none focus:ring-1 focus:ring-amber-400"
    />

    <!-- Action buttons -->
    <div v-if="!decided" class="flex flex-wrap gap-2">
      <!-- Review mode buttons -->
      <template v-if="mode === 'review'">
        <button v-if="config.allowedDecisions.includes('approve')"
          class="text-xs font-sans font-semibold rounded px-3 py-1.5 transition-colors bg-green-600 text-white hover:bg-green-700"
          @click="approve">
          ✓ 批准
        </button>
        <button v-if="config.allowedDecisions.includes('reject')"
          class="text-xs font-sans font-semibold rounded px-3 py-1.5 transition-colors bg-red-600 text-white hover:bg-red-700"
          @click="mode = 'reject'">
          ✕ 拒绝
        </button>
        <button v-if="config.allowedDecisions.includes('edit')"
          class="text-xs font-sans font-semibold rounded px-3 py-1.5 transition-colors bg-blue-600 text-white hover:bg-blue-700"
          @click="enterEdit">
          ✎ 编辑
        </button>
        <button v-if="config.allowedDecisions.includes('respond')"
          class="text-xs font-sans font-semibold rounded px-3 py-1.5 transition-colors bg-purple-600 text-white hover:bg-purple-700"
          @click="mode = 'respond'">
          ↩ 回应
        </button>
      </template>

      <!-- Reject confirm -->
      <template v-if="mode === 'reject'">
        <button class="text-xs font-sans font-semibold rounded px-3 py-1.5 transition-colors bg-red-600 text-white hover:bg-red-700" @click="reject">确认拒绝</button>
        <button class="text-xs font-sans font-semibold rounded px-3 py-1.5 transition-colors bg-amber-100 text-amber-700 hover:bg-amber-200 border border-amber-300" @click="mode = 'review'">取消</button>
      </template>

      <!-- Edit confirm -->
      <template v-if="mode === 'edit'">
        <button class="text-xs font-sans font-semibold rounded px-3 py-1.5 transition-colors bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed" :disabled="!!jsonError" @click="submitEdit">提交编辑</button>
        <button class="text-xs font-sans font-semibold rounded px-3 py-1.5 transition-colors bg-amber-100 text-amber-700 hover:bg-amber-200 border border-amber-300" @click="cancelEdit">取消</button>
      </template>

      <!-- Respond confirm -->
      <template v-if="mode === 'respond'">
        <button class="text-xs font-sans font-semibold rounded px-3 py-1.5 transition-colors bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed" :disabled="!respondMessage.trim()" @click="submitRespond">发送回复</button>
        <button class="text-xs font-sans font-semibold rounded px-3 py-1.5 transition-colors bg-amber-100 text-amber-700 hover:bg-amber-200 border border-amber-300" @click="mode = 'review'">取消</button>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { ActionRequest, ReviewConfig, HITLResponse } from "./hitl.types";

const props = defineProps<{
  action: ActionRequest;
  config: ReviewConfig;
  index?: number;
}>();

const emit = defineEmits<{
  (e: "respond", response: HITLResponse): void;
}>();

type Mode = "review" | "reject" | "edit" | "respond";
const mode = ref<Mode>("review");
const decided = ref(false);
const lastResponse = ref<HITLResponse | null>(null);

const rejectReason = ref("");
const respondMessage = ref("");
const editedJson = ref("");
const jsonError = ref(false);

const argsText = computed(() => JSON.stringify(props.action.args, null, 2));

watch(editedJson, (v) => {
  try { JSON.parse(v); jsonError.value = false; }
  catch { jsonError.value = true; }
});

function enterEdit() {
  editedJson.value = argsText.value;
  jsonError.value = false;
  mode.value = "edit";
}

function cancelEdit() {
  mode.value = "review";
  jsonError.value = false;
}

function approve() {
  resolve({ decision: "approve" });
}

function reject() {
  resolve({ decision: "reject", ...(rejectReason.value.trim() ? { reason: rejectReason.value.trim() } : {}) });
}

function submitEdit() {
  if (jsonError.value) return;
  try {
    const args = JSON.parse(editedJson.value);
    resolve({ decision: "edit", args });
  } catch { /* ignore */ }
}

function submitRespond() {
  if (!respondMessage.value.trim()) return;
  resolve({ decision: "respond", message: respondMessage.value.trim() });
}

function resolve(response: HITLResponse) {
  lastResponse.value = response;
  decided.value = true;
  emit("respond", response);
}

const decidedLabel = computed(() => {
  if (!lastResponse.value) return "";
  const map: Record<string, string> = {
    approve: "已批准",
    reject: "已拒绝",
    edit: "已编辑",
    respond: "已回复",
  };
  return map[lastResponse.value.decision] ?? lastResponse.value.decision;
});

const decidedClass = computed(() => {
  if (!lastResponse.value) return "";
  const map: Record<string, string> = {
    approve: "bg-green-100 text-green-700",
    reject: "bg-red-100 text-red-700",
    edit: "bg-blue-100 text-blue-700",
    respond: "bg-purple-100 text-purple-700",
  };
  return map[lastResponse.value.decision] ?? "";
});
</script>

