<template>
  <div style="border: 1px solid #fcd34d; border-radius: 8px; background: #fffbeb; font-size: 13px; width: 100%; overflow: hidden;">
    <!-- Header -->
    <div style="display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: #fef3c7; border-bottom: 1px solid #fcd34d;">
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#d97706" stroke-width="2">
        <circle cx="8" cy="8" r="6" />
        <line x1="8" y1="5" x2="8" y2="8.5" />
        <circle cx="8" cy="11" r="0.8" fill="#d97706" stroke="none" />
      </svg>
      <span style="font-weight: 600; color: #92400e;">需要人工审核</span>
      <span v-if="totalActions > 1" style="margin-left: auto; font-size: 11px; color: #b45309;">
        {{ decidedCount }} / {{ totalActions }} 已决策
      </span>
    </div>

    <!-- Action panels -->
    <div :style="totalActions > 1 ? 'divide-y: 1px solid #fde68a' : ''">
      <div
        v-for="(action, i) in request.actionRequests"
        :key="i"
        style="padding: 12px; display: flex; flex-direction: column; gap: 10px;"
        :style="i > 0 ? 'border-top: 1px solid #fde68a' : ''"
      >
        <!-- Action title row -->
        <div style="display: flex; align-items: flex-start; gap: 8px;">
          <span v-if="totalActions > 1"
            style="flex-shrink: 0; width: 20px; height: 20px; border-radius: 50%; background: #fde68a; color: #92400e; font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center; margin-top: 1px;">
            {{ i + 1 }}
          </span>
          <div style="flex: 1; min-width: 0;">
            <div style="font-family: monospace; font-weight: 600; color: #78350f;">{{ action.action }}</div>
            <div v-if="action.description" style="font-size: 11px; color: #b45309; margin-top: 2px;">{{ action.description }}</div>
          </div>
          <span v-if="panelState[i]?.decided"
            style="flex-shrink: 0; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; padding: 2px 6px; border-radius: 4px;"
            :style="decidedBadgeStyle(i)">
            {{ decidedLabel(i) }}
          </span>
        </div>

        <!-- Args box -->
        <div style="border: 1px solid #fde68a; border-radius: 6px; background: white; overflow: hidden;">
          <textarea
            v-if="panelState[i]?.mode === 'edit'"
            v-model="panelState[i].editJson"
            rows="6"
            style="width: 100%; padding: 8px 12px; font-family: monospace; font-size: 11px; color: #3f3f46; resize: vertical; outline: none; border: none; box-sizing: border-box;"
            :style="panelState[i].jsonError ? 'outline: 1px solid #f87171' : ''"
            spellcheck="false"
          />
          <div v-if="panelState[i]?.mode === 'edit' && panelState[i].jsonError"
            style="padding: 0 12px 8px; font-size: 11px; color: #ef4444;">JSON 格式错误</div>
          <pre v-else style="padding: 8px 12px; font-family: monospace; font-size: 11px; color: #52525b; white-space: pre-wrap; word-break: break-all; margin: 0;">{{ JSON.stringify(action.args, null, 2) }}</pre>
        </div>

        <!-- Reject textarea -->
        <textarea
          v-if="panelState[i]?.mode === 'reject'"
          v-model="panelState[i].rejectReason"
          rows="3"
          placeholder="拒绝理由（可选）…"
          style="width: 100%; border: 1px solid #fde68a; border-radius: 6px; background: white; padding: 8px 12px; font-size: 11px; color: #3f3f46; resize: none; outline: none; box-sizing: border-box;"
        />
        <!-- Respond textarea -->
        <textarea
          v-if="panelState[i]?.mode === 'respond'"
          v-model="panelState[i].respondMsg"
          rows="3"
          placeholder="输入你的回复…"
          style="width: 100%; border: 1px solid #fde68a; border-radius: 6px; background: white; padding: 8px 12px; font-size: 11px; color: #3f3f46; resize: none; outline: none; box-sizing: border-box;"
        />

        <!-- Buttons -->
        <div v-if="!panelState[i]?.decided" style="display: flex; flex-wrap: wrap; gap: 6px;">
          <template v-if="panelState[i]?.mode === 'review'">
            <button v-if="request.reviewConfigs[i]?.allowedDecisions.includes('approve')"
              style="font-size: 11px; font-weight: 600; border-radius: 6px; padding: 5px 12px; border: none; cursor: pointer; background: #16a34a; color: white;"
              @click="approve(i)">✓ 批准</button>
            <button v-if="request.reviewConfigs[i]?.allowedDecisions.includes('reject')"
              style="font-size: 11px; font-weight: 600; border-radius: 6px; padding: 5px 12px; border: none; cursor: pointer; background: #dc2626; color: white;"
              @click="panelState[i].mode = 'reject'">✕ 拒绝</button>
            <button v-if="request.reviewConfigs[i]?.allowedDecisions.includes('edit')"
              style="font-size: 11px; font-weight: 600; border-radius: 6px; padding: 5px 12px; border: none; cursor: pointer; background: #2563eb; color: white;"
              @click="enterEdit(i)">✎ 编辑</button>
            <button v-if="request.reviewConfigs[i]?.allowedDecisions.includes('respond')"
              style="font-size: 11px; font-weight: 600; border-radius: 6px; padding: 5px 12px; border: none; cursor: pointer; background: #7c3aed; color: white;"
              @click="panelState[i].mode = 'respond'">↩ 回应</button>
          </template>
          <template v-if="panelState[i]?.mode === 'reject'">
            <button style="font-size: 11px; font-weight: 600; border-radius: 6px; padding: 5px 12px; border: none; cursor: pointer; background: #dc2626; color: white;" @click="reject(i)">确认拒绝</button>
            <button style="font-size: 11px; font-weight: 600; border-radius: 6px; padding: 5px 12px; cursor: pointer; background: #fef3c7; color: #92400e; border: 1px solid #fcd34d;" @click="panelState[i].mode = 'review'">取消</button>
          </template>
          <template v-if="panelState[i]?.mode === 'edit'">
            <button style="font-size: 11px; font-weight: 600; border-radius: 6px; padding: 5px 12px; border: none; cursor: pointer; background: #2563eb; color: white;" :disabled="panelState[i].jsonError" @click="submitEdit(i)">提交编辑</button>
            <button style="font-size: 11px; font-weight: 600; border-radius: 6px; padding: 5px 12px; cursor: pointer; background: #fef3c7; color: #92400e; border: 1px solid #fcd34d;" @click="cancelEdit(i)">取消</button>
          </template>
          <template v-if="panelState[i]?.mode === 'respond'">
            <button style="font-size: 11px; font-weight: 600; border-radius: 6px; padding: 5px 12px; border: none; cursor: pointer; background: #7c3aed; color: white;" :disabled="!panelState[i].respondMsg?.trim()" @click="submitRespond(i)">发送回复</button>
            <button style="font-size: 11px; font-weight: 600; border-radius: 6px; padding: 5px 12px; cursor: pointer; background: #fef3c7; color: #92400e; border: 1px solid #fcd34d;" @click="panelState[i].mode = 'review'">取消</button>
          </template>
        </div>
      </div>
    </div>

    <!-- Multi-action submit all -->
    <div v-if="totalActions > 1" style="padding: 8px 12px; border-top: 1px solid #fcd34d; background: #fef3c7; display: flex; justify-content: flex-end;">
      <button
        style="font-size: 11px; font-weight: 600; border-radius: 6px; padding: 5px 12px; border: none; cursor: pointer; transition: background 0.15s;"
        :style="allDecided ? 'background: #d97706; color: white;' : 'background: #fde68a; color: #a16207; cursor: not-allowed;'"
        :disabled="!allDecided"
        @click="submitAll"
      >
        提交全部决策
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from "vue";

export interface ActionRequest {
  action: string;
  description?: string;
  args: Record<string, unknown>;
}
export interface ReviewConfig {
  allowedDecisions: Array<"approve" | "reject" | "edit" | "respond">;
}
export interface HITLRequest {
  actionRequests: ActionRequest[];
  reviewConfigs: ReviewConfig[];
}
export type HITLResponse =
  | { decision: "approve" }
  | { decision: "reject"; reason?: string }
  | { decision: "edit"; args: Record<string, unknown> }
  | { decision: "respond"; message: string };

interface PanelState {
  mode: "review" | "reject" | "edit" | "respond";
  decided: boolean;
  response: HITLResponse | null;
  rejectReason: string;
  respondMsg: string;
  editJson: string;
  jsonError: boolean;
}

const props = defineProps<{ request: HITLRequest }>();
const emit = defineEmits<{ respond: [responses: HITLResponse[]] }>();

const panelState = reactive<Record<number, PanelState>>({});

watch(
  () => props.request.actionRequests.length,
  (len) => {
    for (let i = 0; i < len; i++) {
      if (!panelState[i]) {
        panelState[i] = { mode: "review", decided: false, response: null, rejectReason: "", respondMsg: "", editJson: "", jsonError: false };
      }
    }
  },
  { immediate: true }
);

const totalActions = computed(() => props.request.actionRequests.length);
const decidedCount = computed(() => Object.values(panelState).filter((s) => s.decided).length);
const allDecided = computed(() => decidedCount.value === totalActions.value);

function resolve(i: number, response: HITLResponse) {
  panelState[i]!.decided = true;
  panelState[i]!.response = response;
  if (totalActions.value === 1) emit("respond", [response]);
}

function approve(i: number) { resolve(i, { decision: "approve" }); }

function reject(i: number) {
  const reason = panelState[i]!.rejectReason.trim();
  resolve(i, reason ? { decision: "reject", reason } : { decision: "reject" });
}

function enterEdit(i: number) {
  panelState[i]!.editJson = JSON.stringify(props.request.actionRequests[i]?.args ?? {}, null, 2);
  panelState[i]!.jsonError = false;
  panelState[i]!.mode = "edit";
}

function cancelEdit(i: number) {
  panelState[i]!.mode = "review";
  panelState[i]!.jsonError = false;
}

function submitEdit(i: number) {
  try {
    const args = JSON.parse(panelState[i]!.editJson);
    resolve(i, { decision: "edit", args });
  } catch { panelState[i]!.jsonError = true; }
}

function submitRespond(i: number) {
  const message = panelState[i]!.respondMsg.trim();
  if (!message) return;
  resolve(i, { decision: "respond", message });
}

function submitAll() {
  if (!allDecided.value) return;
  const responses = props.request.actionRequests
    .map((_, i) => panelState[i]?.response)
    .filter((r): r is HITLResponse => r !== null && r !== undefined);
  emit("respond", responses);
}

function decidedLabel(i: number): string {
  const d = panelState[i]?.response?.decision;
  if (!d) return "";
  return { approve: "已批准", reject: "已拒绝", edit: "已编辑", respond: "已回复" }[d];
}

function decidedBadgeStyle(i: number): string {
  const d = panelState[i]?.response?.decision;
  const map: Record<string, string> = {
    approve: "background:#dcfce7;color:#15803d",
    reject: "background:#fee2e2;color:#b91c1c",
    edit: "background:#dbeafe;color:#1d4ed8",
    respond: "background:#ede9fe;color:#6d28d9",
  };
  return map[d ?? ""] ?? "";
}
</script>
