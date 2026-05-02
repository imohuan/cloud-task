<template>
  <div class="min-h-screen bg-white p-6 max-w-xl mx-auto space-y-4">
    <h1 class="text-zinc-500 text-sm font-sans font-semibold uppercase tracking-widest">Task Queue</h1>
    <TaskQueueView :queue="demoQueue" />

    <h1 class="text-zinc-500 text-sm font-sans font-semibold uppercase tracking-widest mt-2">Human</h1>
    <HumanBubble :content="humanMsg" @edit="val => humanMsg = val">{{ humanMsg }}</HumanBubble>

    <h1 class="text-zinc-500 text-sm font-sans font-semibold uppercase tracking-widest mt-2">Thinking</h1>
    <ThinkingBubble :is-streaming="thinkingStreaming.isStreaming">
      <Markdown :content="thinkingStreaming.content" />
    </ThinkingBubble>
    <ThinkingBubble :is-streaming="thinkingDone.isStreaming">
      <Markdown :content="thinkingDone.content" />
    </ThinkingBubble>

    <h1 class="text-zinc-500 text-sm font-sans font-semibold uppercase tracking-widest mt-2">File Tools</h1>
    <ReadFileBubble :tool-call="(readFileDemoCall as any)" />
    <ReadFileBubble :tool-call="(loadSkillDemoCall as any)" />
    <EditFileBubble :tool-call="(editFileStreamingCall as any)" />
    <EditFileBubble :tool-call="(editFileDoneCall as any)" />

    <h1 class="text-zinc-500 text-sm font-sans font-semibold uppercase tracking-widest mt-2">Web Search</h1>
    <WebSearchBubble :tool-call="(searchDemoCompleted as any)" />
    <WebSearchBubble :tool-call="(searchDemoPending as any)" />

    <h1 class="text-zinc-500 text-sm font-sans font-semibold uppercase tracking-widest mt-2">Assistant</h1>
    <Markdown class="w-full  overflow-auto" :content="aiOutput" :auto-scroll="true" />
    <button
      class="self-start text-[12px] text-zinc-400 hover:text-zinc-600 border border-zinc-200 rounded px-2 py-0.5 transition-colors disabled:opacity-40"
      :disabled="streaming" @click="startStream">
      {{ streaming ? "Streaming…" : "▶ 模拟流式输出" }}
    </button>

    <h1 class="text-zinc-500 text-sm font-sans font-semibold uppercase tracking-widest mt-2">Tool Calls</h1>
    <ToolCard v-for="item in toolCalls" :key="item.call.id" :toolCall="(item as any)" />

    <h1 class="text-zinc-500 text-sm font-sans font-semibold uppercase tracking-widest mt-2">HITL 审核卡</h1>
    <!-- Single action: approve / reject / edit -->
    <HITLApprovalCard :request="hitlEmail" @respond="onHITLRespond" />
    <!-- Single action: respond only -->
    <HITLApprovalCard :request="hitlAskUser" @respond="onHITLRespond" />
    <!-- Multi-action -->
    <HITLApprovalCard :request="hitlMulti" @respond="onHITLRespond" />
    <pre v-if="hitlLog" class="text-[11px] font-mono bg-zinc-50 border border-zinc-200 rounded px-3 py-2 whitespace-pre-wrap">{{ hitlLog }}</pre>

    <h1 class="text-zinc-500 text-sm font-sans font-semibold uppercase tracking-widest mt-2">Chat Input</h1>
    <ChatInput
      v-model:model-id="chatModelId"
      :models="chatModels"
      dropdown-title="选择模型"
      @send="onSend"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onUnmounted } from "vue";

import ToolCard from "../components/ToolCard.vue";
import ThinkingBubble from "../components/ThinkingBubble.vue";
import HumanBubble from "../components/HumanBubble.vue";
import Markdown from "../components/Markdown.vue";
import WebSearchBubble from "../components/WebSearchBubble.vue";
import ReadFileBubble from "../components/ReadFileBubble.vue";
import EditFileBubble from "../components/EditFileBubble.vue";
import TaskQueueView from "../components/TaskQueueView.vue";
import type { Queue } from "../components/TaskQueueView.vue";
import ChatInput from "../components/ChatInput.vue";
import type { ChatImage } from "../components/ChatInput.vue";
import HITLApprovalCard from "../components/HITLApprovalCard.vue";
import type { HITLRequest, HITLResponse } from "../components/hitl.types";

const hitlLog = ref("");

const hitlEmail: HITLRequest = {
  actionRequests: [
    {
      action: "send_email",
      description: "发送一封关于项目延期的通知邮件给客户。",
      args: {
        to: "client@example.com",
        subject: "项目进度更新",
        body: "您好，由于需求变更，项目预计延期两周，请知悉。",
      },
    },
  ],
  reviewConfigs: [{ allowedDecisions: ["approve", "reject", "edit"] }],
};

const hitlAskUser: HITLRequest = {
  actionRequests: [
    {
      action: "ask_user",
      description: "代理需要收集更多信息才能继续。",
      args: { question: "你希望报告使用中文还是英文输出？" },
    },
  ],
  reviewConfigs: [{ allowedDecisions: ["respond"] }],
};

const hitlMulti: HITLRequest = {
  actionRequests: [
    {
      action: "update_record",
      description: "更新数据库中用户的订阅等级。",
      args: { userId: "usr_8821", plan: "pro", billingCycle: "yearly" },
    },
    {
      action: "call_api",
      description: "调用外部支付服务完成扣款。",
      args: { endpoint: "https://pay.example.com/charge", amount: 299, currency: "CNY" },
    },
  ],
  reviewConfigs: [
    { allowedDecisions: ["approve", "reject"] },
    { allowedDecisions: ["approve", "reject", "edit"] },
  ],
};

function onHITLRespond(responses: HITLResponse[]) {
  hitlLog.value = JSON.stringify(responses, null, 2);
}

const chatModelId = ref("fast");
const chatModels = [
  { id: "fast",  name: "快速", desc: "快速回答" },
  { id: "think", name: "思考", desc: "解决复杂问题" },
  { id: "pro",   name: "Pro",  desc: "擅长高阶数学和代码，思考时间更长" },
];

function onSend(text: string, images: ChatImage[]) {
  console.log("发送:", text, "图片:", images.length);
}


// const stream = useStream({
//   assistantId: "tool-calling"
// });

const demoQueue: Queue = {
  size: 2,
  entries: [
    {
      id: "q-001",
      values: { messages: [{ content: "帮我查询 Manifest V3 的限制" }] },
      options: {},
      createdAt: new Date(Date.now() - 18000).toISOString(),
    },
    {
      id: "q-002",
      values: { input: "修改 background.js 并适配 Service Worker" },
      options: {},
      createdAt: new Date(Date.now() - 5000).toISOString(),
    },
  ],
  cancel: async (id) => {
    demoQueue.entries = demoQueue.entries.filter((e) => e.id !== id);
    demoQueue.size = demoQueue.entries.length;
  },
  clear: async () => {
    demoQueue.entries = [];
    demoQueue.size = 0;
  },
};


const readFileDemoCall = {
  call: { id: "call_read_001", name: "read_file", args: { path: "WebSearchResult.vue" } },
  result: { content: "" },
  state: "completed" as const,
};

const loadSkillDemoCall = {
  call: { id: "call_skill_001", name: "load_skills", args: { skillName: "web-search" } },
  result: { content: "" },
  state: "completed" as const,
};

const humanMsg = ref("帮我查询一下 Manifest V3 的脚本执行限制，并修改我的 background.js");

const editFileStreamingCall = {
  call: { id: "call_edit_001", name: "edit_file", args: { path: "WebSearchBubble.vue" }, type: "tool_call" },
  result: undefined,
  state: "pending" as const,
};

const editFileDoneCall = {
  call: {
    id: "call_edit_002", name: "edit_file", type: "tool_call",
    args: {
      path: "AgentsPage.vue",
      old_string: 'import WebSearchResult from "./WebSearchResult.vue";',
      new_string: 'import ReadFileBubble from "./ReadFileBubble.vue";\nimport EditFileBubble from "./EditFileBubble.vue";',
    },
  },
  result: { content: '已编辑 "AgentsPage.vue"，共替换 1 处' },
  state: "completed" as const,
};

const searchDemoCompleted = {
  call: { id: "call_search_001", name: "search_web", args: { query: "成都今天天气 2026年5月1日", maxResults: 5 } },
  result: {
    content: JSON.stringify({
      query: "成都今天天气 2026年5月1日",
      responseTime: 0.8,
      images: [],
      results: [
        { title: "成都-天气预报", url: "https://weather.example.com/chengdu", content: "成都今日天气：晴转多云，气温 18–26°C，东北风 2 级，空气质量良。", rawContent: null, score: 0.9312 },
        { title: "成都天气预报,成都7天天气预报,成都15天天气预报...", url: "https://www.tianqi.com/chengdu/", content: "成都最新天气预报，7天、15天天气一网打尽，支持按小时查询。", rawContent: null, score: 0.8741 },
        { title: "天气预报- 中国气象局", url: "https://www.cma.gov.cn", content: "中国气象局官方网站，提供全国各地权威天气预报服务。", rawContent: null, score: 0.8124 },
        { title: "2026成都五一每日天气预报- 成都本地宝", url: "https://cd.bendibao.com/weather/", content: "五一假期成都每日天气预报，出行必备攻略。", rawContent: null, score: 0.7698 },
        { title: "【成都天气】成都今天天气预报", url: "https://tianqi.so.com/chengdu/", content: "成都实时天气数据，温度、湿度、风向等详细信息。", rawContent: null, score: 0.7213 },
      ],
    }),
  },
  state: "completed" as const,
};

const searchDemoPending = {
  call: { id: "call_search_002", name: "search_web", args: { query: "Vue 3 composition API", maxResults: 3 } },
  result: undefined,
  state: "pending" as const,
};

const fullText = [
  "Manifest V3 对脚本执行有以下主要限制：\n\n",
  "## 主要变更\n\n",
  "- **不再支持** `executeScript` 中传入字符串形式的代码\n",
  "- **禁止**远程托管代码（Remote Hosted Code）\n",
  "- `background.js` 必须改为 **Service Worker**（`background.service_worker`）\n\n",
  "## background.js 修改示例\n\n",
  "```js\n// manifest.json\n{\n  \"background\": {\n    \"service_worker\": \"background.js\"\n  }\n}\n```\n\n",
  "```js\n// background.js\nself.addEventListener('install', () => self.skipWaiting());\nself.addEventListener('activate', () => clients.claim());\n\nchrome.runtime.onMessage.addListener((msg, sender, reply) => {\n  if (msg.type === 'ping') reply({ status: 'ok' });\n});\n```\n\n",
  "> Service Worker 无 DOM 访问，生命周期由浏览器管理，注意用 `chrome.storage` 持久化状态。\n",
].join("");

const aiOutput = ref("> 占无内容");
const streaming = ref(false);
let streamTimer: ReturnType<typeof setTimeout> | null = null;

function startStream() {
  aiOutput.value = "";
  streaming.value = true;
  let i = 0;
  const chunk = 10;
  function tick() {
    if (i >= fullText.length) {
      streaming.value = false;
      return;
    }
    aiOutput.value += fullText.slice(i, i + chunk);
    i += chunk;
    streamTimer = setTimeout(tick, 25);
  }
  tick();
}

onUnmounted(() => {
  if (streamTimer) clearTimeout(streamTimer);
});

const thinkingDone = {
  content:
    "用户询问的是一道数学题：2 + 3 * 4。\n根据运算优先级，乘法先于加法：3 * 4 = 12，然后 2 + 12 = 14。\n所以答案是 14。",
  isStreaming: false,
};

const thinkingStreaming = {
  content: "让我仔细分析这个问题……首先需要考虑",
  isStreaming: true,
};

const toolCalls = [
  {
    call: { id: "call_001", name: "calculator", args: { expression: "2 + 3 * 4" } },
    result: { content: '{"expression":"2 + 3 * 4","result":14}' },
    state: "completed" as const,
  },
  {
    call: { id: "call_002", name: "search_web", args: { query: "Vue 3 composition API" } },
    result: undefined,
    state: "pending" as const,
  },
  {
    call: { id: "call_003", name: "weather", args: { city: "Beijing" } },
    result: { content: "Network timeout: unable to reach weather service" },
    state: "error" as const,
  },
];
</script>