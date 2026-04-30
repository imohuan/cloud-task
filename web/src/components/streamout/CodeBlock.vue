<script setup lang="ts">
/**
 * 自定义代码块渲染组件
 * 通过 :components="{ pre: CodeBlock }" 覆盖 comark 内置 pre 渲染
 * comark 会把原始节点属性（language / filename 等）作为 props 传入，
 * 高亮后的子节点（code > span...）通过默认 slot 传入。
 */
defineProps<{
  language?: string;
  filename?: string;
}>();
</script>

<template>
  <div class="code-block-wrapper mb-3 overflow-hidden rounded-lg border border-slate-200">
    <div
      v-if="language || filename"
      class="flex items-center justify-between border-b border-slate-200 px-4 py-2 text-xs text-slate-500"
    >
      <span class="font-mono">{{ filename || language }}</span>
      <span class="text-slate-400">{{ language }}</span>
    </div>
    <div class="relative overflow-x-auto p-4">
      <pre class="m-0 text-sm leading-relaxed"><slot /></pre>
    </div>
  </div>
</template>

<style scoped>
/* 强制在深色代码块内使用 Shiki dark 主题颜色 */
.code-block-wrapper :deep(.shiki span) {
  color: var(--shiki-dark) !important;
  background-color: var(--shiki-dark-bg) !important;
  font-style: var(--shiki-dark-font-style) !important;
  font-weight: var(--shiki-dark-font-weight) !important;
  text-decoration: var(--shiki-dark-text-decoration) !important;
}
</style>
