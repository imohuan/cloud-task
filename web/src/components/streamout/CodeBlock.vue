<script setup lang="ts">
/**
 * 自定义代码块渲染组件
 * 接收 comark 插件解析后的 props
 */
defineProps<{
  lang?: string;
  code?: string;
  filename?: string;
}>();
</script>

<template>
  <div class="code-block-wrapper mb-3 overflow-hidden rounded-lg border border-slate-200">
    <div
      v-if="lang || filename"
      class="flex items-center justify-between bg-slate-50 px-4 py-2 text-xs text-slate-500 border-b border-slate-200"
    >
      <span class="font-mono">{{ filename || lang }}</span>
      <span class="text-slate-400">{{ lang }}</span>
    </div>
    <div class="relative bg-[#0f172a] p-4">
      <!-- 这里可以替换成你的真实编辑器组件，比如 Monaco / CodeMirror / Prism 等 -->
      <pre class="m-0 overflow-x-auto text-sm leading-relaxed"><code class="font-mono text-[#e2e8f0]">{{ code }}</code></pre>
    </div>
  </div>
</template>
