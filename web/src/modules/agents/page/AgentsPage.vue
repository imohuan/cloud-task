<template>
  <div class="min-h-screen bg-white p-6 flex flex-col gap-4 max-w-xl mx-auto">
    <h1 class="text-zinc-500 text-sm font-sans font-semibold uppercase tracking-widest">Human</h1>
    <HumanBubble :content="humanMsg" @edit="val => humanMsg = val">{{ humanMsg }}</HumanBubble>

    <h1 class="text-zinc-500 text-sm font-sans font-semibold uppercase tracking-widest mt-2">Thinking</h1>
    <ThinkingBubble v-bind="thinkingStreaming" />
    <ThinkingBubble v-bind="thinkingDone" />

    <h1 class="text-zinc-500 text-sm font-sans font-semibold uppercase tracking-widest mt-2">File Tools</h1>
    <ReadFileBubble filename="WebSearchResult.vue" />
    <EditFileBubble filename="WebSearchBubble.vue" :is-streaming="true" :is-new="true" :tokens="30" />
    <EditFileBubble filename="AgentsPage.vue" :is-new="false" :diff="fileDiff" :stats="{ added: 3, removed: 1 }" />

    <h1 class="text-zinc-500 text-sm font-sans font-semibold uppercase tracking-widest mt-2">Web Search</h1>
    <WebSearchBubble :query="searchDemo.query" :results="searchDemo.results" />
    <WebSearchBubble :query="searchDemo.query" :is-streaming="true" />

    <h1 class="text-zinc-500 text-sm font-sans font-semibold uppercase tracking-widest mt-2">Assistant</h1>
    <Markdown :content="aiOutput" :auto-scroll="true" />
    <button
      class="self-start text-[12px] text-zinc-400 hover:text-zinc-600 border border-zinc-200 rounded px-2 py-0.5 transition-colors disabled:opacity-40"
      :disabled="streaming" @click="startStream">
      {{ streaming ? "Streaming…" : "▶ 模拟流式输出" }}
    </button>

    <h1 class="text-zinc-500 text-sm font-sans font-semibold uppercase tracking-widest mt-2">Tool Calls</h1>
    <ToolCard v-for="item in toolCalls" :key="item.call.id" :toolCall="item" />
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
const humanMsg = ref("帮我查询一下 Manifest V3 的脚本执行限制，并修改我的 background.js");

const fileDiff = [
  { type: "context" as const, content: "import Markdown from \"./Markdown.vue\";" },
  { type: "remove" as const,  content: "import WebSearchResult from \"./WebSearchResult.vue\";" },
  { type: "add" as const,     content: "import WebSearchBubble from \"./WebSearchBubble.vue\";" },
  { type: "add" as const,     content: "import ReadFileBubble from \"./ReadFileBubble.vue\";" },
  { type: "add" as const,     content: "import EditFileBubble from \"./EditFileBubble.vue\";" },
  { type: "context" as const, content: "" },
];

const searchDemo = {
  query: "成都今天天气 2026年5月1日",
  results: [
    { title: "成都-天气预报", url: "https://weather.example.com/chengdu" },
    { title: "成都天气预报,成都7天天气预报,成都15天天气预报...", url: "https://www.tianqi.com/chengdu/" },
    { title: "天气预报- 中国气象局", url: "https://www.cma.gov.cn" },
    { title: "2026成都五一每日天气预报- 成都本地宝", url: "https://cd.bendibao.com/weather/" },
    { title: "【成都天气】成都今天天气预报,今天,今天天气...", url: "https://tianqi.so.com/chengdu/" },
  ],
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