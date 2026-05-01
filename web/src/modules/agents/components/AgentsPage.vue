<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-xl font-bold text-slate-800">Agent 管理</h1>
        <p class="mt-0.5 text-sm text-slate-500">创建和管理你的 AI Agent</p>
      </div>
      <button
        class="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 active:scale-95"
        @click="openCreateModal"
      >
        <AddFilled class="h-4 w-4" />
        创建 Agent
      </button>
    </div>

    <!-- Filter Tabs -->
    <div class="flex gap-1 rounded-lg bg-slate-100 p-1 w-fit">
      <button
        v-for="tab in tabs"
        :key="tab.value"
        :class="[
          'rounded-md px-3 py-1.5 text-sm font-medium transition-all',
          activeTab === tab.value
            ? 'bg-white text-slate-800 shadow-sm'
            : 'text-slate-500 hover:text-slate-700',
        ]"
        @click="activeTab = tab.value"
      >
        {{ tab.label }}
        <span
          v-if="getCountByTab(tab.value) > 0"
          :class="[
            'ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold',
            activeTab === tab.value ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-500',
          ]"
        >
          {{ getCountByTab(tab.value) }}
        </span>
      </button>
    </div>

    <!-- Agent Grid -->
    <div v-if="filteredAgents.length" class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div
        v-for="agent in filteredAgents"
        :key="agent.id"
        class="group relative flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-blue-200 hover:shadow-md"
      >
        <!-- Status Dot -->
        <span
          :class="[
            'absolute right-4 top-4 h-2 w-2 rounded-full',
            agent.status === 'active' ? 'bg-emerald-400' : 'bg-slate-300',
          ]"
          :title="agent.status === 'active' ? '运行中' : '已停止'"
        />

        <!-- Agent Avatar + Name -->
        <div class="flex items-center gap-3">
          <div
            class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white"
            :style="{ backgroundColor: agent.color }"
          >
            <SmartToyFilled class="h-5 w-5" />
          </div>
          <div class="min-w-0">
            <h3 class="truncate text-sm font-semibold text-slate-800">{{ agent.name }}</h3>
            <span class="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
              {{ agent.model }}
            </span>
          </div>
        </div>

        <!-- Description -->
        <p class="mt-3 line-clamp-2 text-[13px] leading-relaxed text-slate-500">
          {{ agent.description || '暂无描述' }}
        </p>

        <!-- Stats Row -->
        <div class="mt-4 flex items-center gap-4 border-t border-slate-100 pt-3 text-xs text-slate-400">
          <span class="flex items-center gap-1">
            <ChatBubbleFilled class="h-3 w-3" />
            {{ agent.conversations }} 次对话
          </span>
          <span class="flex items-center gap-1">
            <AccessTimeFilled class="h-3 w-3" />
            {{ agent.updatedAt }}
          </span>
        </div>

        <!-- Actions -->
        <div class="mt-3 flex items-center gap-2">
          <button
            :class="[
              'flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition-colors',
              agent.status === 'active'
                ? 'bg-red-50 text-red-600 hover:bg-red-100'
                : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100',
            ]"
            @click="toggleAgent(agent)"
          >
            <component :is="agent.status === 'active' ? PauseFilled : PlayArrowFilled" class="h-3.5 w-3.5" />
            {{ agent.status === 'active' ? '停止' : '启动' }}
          </button>
          <button
            class="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            title="编辑"
            @click="openEditModal(agent)"
          >
            <EditFilled class="h-3.5 w-3.5" />
          </button>
          <button
            class="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
            title="删除"
            @click="confirmDelete(agent)"
          >
            <DeleteFilled class="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="flex flex-col items-center justify-center py-24 text-slate-400">
      <div class="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
        <SmartToyFilled class="h-8 w-8 text-slate-300" />
      </div>
      <p class="text-sm font-medium">
        {{ activeTab === 'all' ? '还没有 Agent' : '该状态下暂无 Agent' }}
      </p>
      <p class="mt-1 text-xs">点击右上角创建你的第一个 Agent</p>
    </div>
  </div>

  <!-- Create / Edit Modal -->
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="modalVisible" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="closeModal" />
        <div class="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl">
          <!-- Modal Header -->
          <div class="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <h2 class="text-base font-semibold text-slate-800">
              {{ editingAgent ? '编辑 Agent' : '创建 Agent' }}
            </h2>
            <button
              class="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100"
              @click="closeModal"
            >
              <CloseFilled class="h-4 w-4" />
            </button>
          </div>

          <!-- Modal Body -->
          <div class="space-y-4 px-6 py-5">
            <div>
              <label class="mb-1.5 block text-xs font-medium text-slate-600">名称 <span class="text-red-500">*</span></label>
              <input
                v-model="form.name"
                type="text"
                placeholder="给 Agent 起个名字"
                class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label class="mb-1.5 block text-xs font-medium text-slate-600">描述</label>
              <input
                v-model="form.description"
                type="text"
                placeholder="简短描述该 Agent 的功能"
                class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label class="mb-1.5 block text-xs font-medium text-slate-600">模型</label>
              <select
                v-model="form.model"
                class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none transition-colors focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              >
                <option v-for="m in modelOptions" :key="m.value" :value="m.value">{{ m.label }}</option>
              </select>
            </div>

            <div>
              <label class="mb-1.5 block text-xs font-medium text-slate-600">系统提示词</label>
              <textarea
                v-model="form.systemPrompt"
                rows="4"
                placeholder="定义 Agent 的角色、行为和限制..."
                class="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <div class="mb-1.5 flex items-center justify-between">
                <label class="text-xs font-medium text-slate-600">温度 (Temperature)</label>
                <span class="text-xs font-medium text-blue-600">{{ form.temperature }}</span>
              </div>
              <input
                v-model.number="form.temperature"
                type="range"
                min="0"
                max="2"
                step="0.1"
                class="w-full accent-blue-500"
              />
              <div class="mt-1 flex justify-between text-[10px] text-slate-400">
                <span>精确</span>
                <span>创意</span>
              </div>
            </div>
          </div>

          <!-- Modal Footer -->
          <div class="flex justify-end gap-3 border-t border-slate-100 px-6 py-4">
            <button
              class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
              @click="closeModal"
            >
              取消
            </button>
            <button
              :disabled="!form.name.trim()"
              class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              @click="saveAgent"
            >
              {{ editingAgent ? '保存修改' : '创建' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <!-- Delete Confirm Modal -->
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="deleteTarget" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" @click="deleteTarget = null" />
        <div class="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
          <div class="mb-1 flex items-center gap-3">
            <div class="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
              <DeleteFilled class="h-5 w-5 text-red-500" />
            </div>
            <h2 class="text-base font-semibold text-slate-800">删除 Agent</h2>
          </div>
          <p class="mt-3 text-sm text-slate-500">
            确认删除 <span class="font-medium text-slate-700">{{ deleteTarget.name }}</span>？此操作不可撤销。
          </p>
          <div class="mt-5 flex justify-end gap-3">
            <button
              class="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
              @click="deleteTarget = null"
            >
              取消
            </button>
            <button
              class="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
              @click="deleteAgent"
            >
              确认删除
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from "vue";
import {
  AddFilled,
  EditFilled,
  DeleteFilled,
  CloseFilled,
  PlayArrowFilled,
  PauseFilled,
  ChatBubbleFilled,
  AccessTimeFilled,
  SmartToyFilled,
} from "@vicons/material";

interface Agent {
  id: string;
  name: string;
  description: string;
  model: string;
  systemPrompt: string;
  temperature: number;
  status: "active" | "stopped";
  color: string;
  conversations: number;
  updatedAt: string;
}

const AVATAR_COLORS = [
  "#3b82f6", "#8b5cf6", "#ec4899", "#f97316", "#10b981", "#06b6d4",
];

const tabs = [
  { label: "全部", value: "all" },
  { label: "运行中", value: "active" },
  { label: "已停止", value: "stopped" },
];

const modelOptions = [
  { label: "GPT-4o", value: "gpt-4o" },
  { label: "GPT-4o mini", value: "gpt-4o-mini" },
  { label: "GPT-4 Turbo", value: "gpt-4-turbo" },
  { label: "GPT-3.5 Turbo", value: "gpt-3.5-turbo" },
  { label: "Claude 3.5 Sonnet", value: "claude-3-5-sonnet" },
  { label: "Claude 3 Opus", value: "claude-3-opus" },
];

const agents = ref<Agent[]>([
  {
    id: "1",
    name: "客服助手",
    description: "专业的客户服务助手，能够处理常见问题、投诉和反馈，提供友好且专业的回复。",
    model: "gpt-4o",
    systemPrompt: "你是一个专业的客服代表，请友好、耐心地解答用户问题。",
    temperature: 0.7,
    status: "active",
    color: "#3b82f6",
    conversations: 128,
    updatedAt: "2 小时前",
  },
  {
    id: "2",
    name: "代码审查员",
    description: "对代码进行深度分析，发现潜在 bug、安全漏洞和性能问题，并给出改进建议。",
    model: "gpt-4o",
    systemPrompt: "你是一个资深的代码审查专家，专注于代码质量、安全性和性能优化。",
    temperature: 0.3,
    status: "active",
    color: "#8b5cf6",
    conversations: 56,
    updatedAt: "1 天前",
  },
  {
    id: "3",
    name: "内容创作者",
    description: "根据主题和要求生成高质量的文章、博客帖子和营销文案。",
    model: "gpt-4o-mini",
    systemPrompt: "你是一个创意写作专家，善于创作引人入胜的内容。",
    temperature: 1.2,
    status: "stopped",
    color: "#ec4899",
    conversations: 312,
    updatedAt: "3 天前",
  },
]);

const activeTab = ref("all");
const modalVisible = ref(false);
const editingAgent = ref<Agent | null>(null);
const deleteTarget = ref<Agent | null>(null);

const form = reactive({
  name: "",
  description: "",
  model: "gpt-4o",
  systemPrompt: "",
  temperature: 0.7,
});

const filteredAgents = computed(() => {
  if (activeTab.value === "all") return agents.value;
  return agents.value.filter((a) => a.status === activeTab.value);
});

const getCountByTab = (tab: string) => {
  if (tab === "all") return agents.value.length;
  return agents.value.filter((a) => a.status === tab).length;
};

const resetForm = () => {
  form.name = "";
  form.description = "";
  form.model = "gpt-4o";
  form.systemPrompt = "";
  form.temperature = 0.7;
};

const openCreateModal = () => {
  editingAgent.value = null;
  resetForm();
  modalVisible.value = true;
};

const openEditModal = (agent: Agent) => {
  editingAgent.value = agent;
  form.name = agent.name;
  form.description = agent.description;
  form.model = agent.model;
  form.systemPrompt = agent.systemPrompt;
  form.temperature = agent.temperature;
  modalVisible.value = true;
};

const closeModal = () => {
  modalVisible.value = false;
  editingAgent.value = null;
  resetForm();
};

const saveAgent = () => {
  if (!form.name.trim()) return;

  if (editingAgent.value) {
    const idx = agents.value.findIndex((a) => a.id === editingAgent.value!.id);
    if (idx !== -1) {
      const existing = agents.value[idx]!;
      agents.value[idx] = {
        id: existing.id,
        status: existing.status,
        color: existing.color,
        conversations: existing.conversations,
        name: form.name.trim(),
        description: form.description.trim(),
        model: form.model,
        systemPrompt: form.systemPrompt,
        temperature: form.temperature,
        updatedAt: "刚刚",
      };
    }
  } else {
    const color = AVATAR_COLORS[agents.value.length % AVATAR_COLORS.length] ?? "#3b82f6";
    agents.value.push({
      id: Date.now().toString(),
      name: form.name.trim(),
      description: form.description.trim(),
      model: form.model,
      systemPrompt: form.systemPrompt,
      temperature: form.temperature,
      status: "stopped",
      color,
      conversations: 0,
      updatedAt: "刚刚",
    });
  }
  closeModal();
};

const toggleAgent = (agent: Agent) => {
  agent.status = agent.status === "active" ? "stopped" : "active";
  agent.updatedAt = "刚刚";
};

const confirmDelete = (agent: Agent) => {
  deleteTarget.value = agent;
};

const deleteAgent = () => {
  if (!deleteTarget.value) return;
  agents.value = agents.value.filter((a) => a.id !== deleteTarget.value!.id);
  deleteTarget.value = null;
};
</script>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-active .relative,
.modal-leave-active .relative {
  transition: transform 0.2s ease;
}
.modal-enter-from .relative,
.modal-leave-to .relative {
  transform: scale(0.95) translateY(8px);
}
</style>
