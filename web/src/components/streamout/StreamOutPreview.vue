<template>
  <div ref="rootRef" class="h-full overflow-auto">
    <Suspense>
      <Comark
        class="comark-preview p-6"
        :options="{ autoClose: true, autoUnwrap: true }"
        :plugins="[codeBlockPlugin()]"
        :components="{ CodeEditor: CodeBlock }"
      >
        {{ content }}
      </Comark>
      <template #fallback>
        <div class="flex h-full items-center justify-center">
          <span class="text-sm text-slate-400">Rendering...</span>
        </div>
      </template>
    </Suspense>
  </div>
</template>

<script setup lang="ts">
import { Comark } from "@comark/vue";
import { ref, watch, nextTick } from "vue";
import CodeBlock from "./CodeBlock.vue";
import { codeBlockPlugin } from "./codeBlockPlugin";

const props = defineProps<{
  content: string;
  autoScroll?: boolean;
}>();

const rootRef = ref<HTMLDivElement>();

watch(
  () => props.content,
  () => {
    if (props.autoScroll && rootRef.value) {
      nextTick(() => {
        rootRef.value!.scrollTop = rootRef.value!.scrollHeight;
      });
    }
  }
);
</script>

<style scoped>
.comark-preview :deep(h1) {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: 0.75rem;
  margin-top: 0.25rem;
  color: #1e293b;
}
.comark-preview :deep(h2) {
  font-size: 1.25rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
  margin-top: 1.25rem;
  color: #1e293b;
  border-bottom: 1px solid #f1f5f9;
  padding-bottom: 0.25rem;
}
.comark-preview :deep(h3) {
  font-size: 1.125rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  margin-top: 1rem;
  color: #334155;
}
.comark-preview :deep(p) {
  margin-bottom: 0.75rem;
  line-height: 1.7;
  color: #334155;
}
.comark-preview :deep(ul) {
  list-style-type: disc;
  padding-left: 1.25rem;
  margin-bottom: 0.75rem;
}
.comark-preview :deep(ol) {
  list-style-type: decimal;
  padding-left: 1.25rem;
  margin-bottom: 0.75rem;
}
.comark-preview :deep(li) {
  margin-bottom: 0.25rem;
  color: #334155;
}
.comark-preview :deep(blockquote) {
  border-left: 3px solid #cbd5e1;
  padding-left: 1rem;
  padding-top: 0.25rem;
  padding-bottom: 0.25rem;
  margin-bottom: 0.75rem;
  margin-top: 0.5rem;
  font-style: italic;
  color: #475569;
  background: #f8fafc;
  border-radius: 0 0.375rem 0.375rem 0;
}
.comark-preview :deep(blockquote p) {
  margin-bottom: 0.25rem;
}
.comark-preview :deep(code) {
  background: #f1f5f9;
  border-radius: 0.25rem;
  padding: 0.125rem 0.375rem;
  font-size: 0.875rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  color: #ef4444;
}
.comark-preview :deep(pre) {
  background: #0f172a;
  color: #f8fafc;
  padding: 1rem;
  border-radius: 0.5rem;
  overflow-x: auto;
  margin-bottom: 0.75rem;
  font-size: 0.875rem;
  line-height: 1.6;
}
.comark-preview :deep(pre code) {
  background: transparent;
  color: inherit;
  padding: 0;
  font-size: inherit;
}
.comark-preview :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 0.75rem;
  font-size: 0.875rem;
}
.comark-preview :deep(th),
.comark-preview :deep(td) {
  border: 1px solid #e2e8f0;
  padding: 0.5rem 0.75rem;
  text-align: left;
}
.comark-preview :deep(th) {
  background: #f8fafc;
  font-weight: 600;
  color: #475569;
}
.comark-preview :deep(tr:nth-child(even)) {
  background: #f8fafc;
}
.comark-preview :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 0.5rem;
  margin: 0.5rem 0;
}
.comark-preview :deep(hr) {
  border: none;
  border-top: 1px solid #e2e8f0;
  margin: 1rem 0;
}
.comark-preview :deep(a) {
  color: #2563eb;
  text-decoration: none;
}
.comark-preview :deep(a:hover) {
  text-decoration: underline;
}
.comark-preview :deep(strong) {
  font-weight: 700;
  color: #1e293b;
}
.comark-preview :deep(del) {
  text-decoration: line-through;
  color: #94a3b8;
}
</style>
