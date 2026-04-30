<script setup lang="ts">
import { computed } from "vue";

/**
 * 自定义代码块渲染组件
 * 通过 :components="{ pre: CodeBlock }" 覆盖 comark 内置 pre 渲染
 * comark 会把原始 AST 节点通过 __node prop 传入（需组件显式声明）
 */
const props = defineProps<{
  language?: string;
  filename?: string;
  __node?: any[];
}>();

const code = computed(() => {
  if (!props.__node) return "";
  // AST 结构: ["pre", { language, filename }, ["code", { class }, "raw code"]]
  const children = props.__node.slice(2);
  for (const child of children) {
    if (Array.isArray(child) && child[0] === "code") {
      // code 节点的第三个元素是原始代码字符串
      const text = child[child.length - 1];
      if (typeof text === "string") return text;
    }
  }
  return "";
});
</script>

<template>
  <div class="code-block-wrapper mb-3 overflow-hidden rounded-lg border border-slate-200">
    <div
      v-if="language || filename"
      class="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-500"
    >
      <span class="font-mono">{{ filename || language }}</span>
      <span class="text-slate-400">{{ language }}</span>
    </div>
    <div class="relative bg-[#0f172a] p-4">
      <!-- 这里可以替换成你的真实编辑器组件，比如 Monaco / CodeMirror / Shiki 等 -->
      <pre class="m-0 overflow-x-auto text-sm leading-relaxed"><code class="font-mono text-[#e2e8f0]">{{ code }}</code></pre>
    </div>
  </div>
</template>
