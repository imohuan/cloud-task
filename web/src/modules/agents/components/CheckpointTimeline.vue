<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useStreamContext } from "@langchain/vue";
import { HumanMessage, AIMessage, SystemMessage } from "langchain";
import type { ThreadState } from "@langchain/langgraph-sdk";
import { usePreviewMessages } from "../composables/usePreviewMessages";

const { history, submit } = useStreamContext();
const { setPreview, clearPreview } = usePreviewMessages();

const isOpen = ref(false);
const selectedId = ref<string | null>(null);

interface FormattedCheckpoint {
    index: number;
    id: string;
    taskName: string;
    messageCount: number;
    hasInterrupt: boolean;
    nextNodes: string[];
    raw: ThreadState;
}

const checkpoints = computed<FormattedCheckpoint[]>(() =>
    (history.value ?? []).map((cp, index) => ({
        index,
        id: cp.checkpoint?.checkpoint_id ?? String(index),
        taskName: cp.tasks?.[0]?.name ?? "unknown",
        messageCount: (cp.values?.messages as unknown[])?.length ?? 0,
        hasInterrupt: cp.tasks?.some((t) => (t.interrupts?.length ?? 0) > 0) ?? false,
        nextNodes: cp.next ?? [],
        raw: cp,
    })),
);

watch(isOpen, (val) => {
    if (!val) {
        selectedId.value = null;
        clearPreview();
    }
});

function deserializeMessages(raw: any[]): any[] {
    return (raw ?? []).map((m: any) => {
        const type = m.type ?? m.kwargs?.type;
        const content = m.content ?? m.kwargs?.content ?? "";
        const id = m.id ?? m.kwargs?.id;
        const additionalKwargs = m.additional_kwargs ?? m.kwargs?.additional_kwargs ?? {};
        const toolCalls = m.tool_calls ?? m.kwargs?.tool_calls ?? [];
        switch (type) {
            case "human":
                return new HumanMessage({ content, id });
            case "ai":
                return new AIMessage({ content, id, tool_calls: toolCalls, additional_kwargs: additionalKwargs });
            case "system":
                return new SystemMessage({ content, id });
            default:
                return new HumanMessage({ content, id });
        }
    });
}

function selectForPreview(cp: FormattedCheckpoint) {
    if (selectedId.value === cp.id) {
        selectedId.value = null;
        clearPreview();
        return;
    }
    selectedId.value = cp.id;
    const rawMsgs = ((cp.raw.values as any)?.messages ?? []) as any[];
    const msgs = deserializeMessages(rawMsgs);
    setPreview(msgs, `#${cp.index + 1} ${cp.taskName}`);
}

function resumeFrom(cp: ThreadState) {
    submit(null, { checkpoint: cp.checkpoint });
    selectedId.value = null;
    clearPreview();
    isOpen.value = false;
}
</script>

<template>
    <!-- Toggle button: slides right when panel opens -->
    <button
        class="absolute top-1/2 -translate-y-1/2 z-20 flex items-center justify-center w-5 h-12 bg-white border border-zinc-200 rounded-r-lg shadow-sm text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50 transition-all duration-200 cursor-pointer"
        :class="isOpen ? 'left-64' : 'left-0'"
        title="检查点时间线"
        @click="isOpen = !isOpen"
    >
        <svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8">
            <circle cx="3.5" cy="4" r="1.5" />
            <circle cx="3.5" cy="8" r="1.5" />
            <circle cx="3.5" cy="12" r="1.5" />
            <line x1="5.5" y1="4" x2="14" y2="4" stroke-linecap="round" />
            <line x1="5.5" y1="8" x2="12" y2="8" stroke-linecap="round" />
            <line x1="5.5" y1="12" x2="10" y2="12" stroke-linecap="round" />
        </svg>
    </button>

    <!-- Sliding panel -->
    <Transition name="slide-left">
        <aside
            v-if="isOpen"
            class="absolute left-0 top-0 bottom-0 z-10 w-64 bg-white border-r border-zinc-200 flex flex-col shadow-lg overflow-hidden"
        >
            <!-- Header -->
            <div class="flex items-center justify-between px-3 py-2.5 border-b border-zinc-200 shrink-0">
                <div class="flex items-center gap-1.5">
                    <svg class="w-3.5 h-3.5 text-zinc-500" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8">
                        <circle cx="3.5" cy="4" r="1.5" />
                        <circle cx="3.5" cy="8" r="1.5" />
                        <circle cx="3.5" cy="12" r="1.5" />
                        <line x1="5.5" y1="4" x2="14" y2="4" stroke-linecap="round" />
                        <line x1="5.5" y1="8" x2="12" y2="8" stroke-linecap="round" />
                        <line x1="5.5" y1="12" x2="10" y2="12" stroke-linecap="round" />
                    </svg>
                    <span class="text-xs font-semibold text-zinc-600 uppercase tracking-wide">检查点时间线</span>
                </div>
                <span class="text-[10px] text-zinc-400 tabular-nums">{{ checkpoints.length }} 条</span>
            </div>

            <!-- Empty state -->
            <div v-if="checkpoints.length === 0" class="flex-1 flex items-center justify-center p-4">
                <p class="text-xs text-zinc-400 italic text-center">暂无检查点记录</p>
            </div>

            <!-- Checkpoint list -->
            <div v-else class="flex-1 overflow-y-auto py-2 px-2 flex flex-col gap-1.5">
                <div
                    v-for="cp in checkpoints"
                    :key="cp.id"
                    class="rounded-lg border text-[11px] transition-all cursor-pointer select-none"
                    :class="[
                        cp.hasInterrupt ? 'border-amber-300' : 'border-zinc-200',
                        selectedId === cp.id
                            ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-200'
                            : cp.hasInterrupt ? 'bg-amber-50/60 hover:bg-amber-50' : 'bg-zinc-50/60 hover:bg-zinc-100/60',
                    ]"
                    @click="selectForPreview(cp)"
                >
                    <div class="flex items-center gap-2 px-2.5 py-2">
                        <span class="text-[10px] text-zinc-400 tabular-nums shrink-0">#{{ cp.index + 1 }}</span>

                        <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-1 flex-wrap">
                                <span class="font-medium text-zinc-700 truncate" :title="cp.taskName">{{ cp.taskName }}</span>
                                <span
                                    v-if="cp.hasInterrupt"
                                    class="rounded bg-amber-200 px-1 py-px text-[9px] font-medium text-amber-800 shrink-0"
                                >
                                    中断
                                </span>
                            </div>
                            <div class="flex items-center gap-2 mt-0.5 text-zinc-400">
                                <span>{{ cp.messageCount }} 条消息</span>
                                <span v-if="cp.nextNodes.length > 0" class="truncate">→ {{ cp.nextNodes.join(", ") }}</span>
                            </div>
                        </div>

                        <!-- Resume button on right -->
                        <button
                            class="shrink-0 text-[10px] font-medium text-blue-500 hover:text-blue-700 hover:bg-blue-100 rounded px-1.5 py-0.5 transition-colors cursor-pointer"
                            @click.stop="resumeFrom(cp.raw)"
                        >
                            恢复
                        </button>
                    </div>
                </div>
            </div>
        </aside>
    </Transition>
</template>

<style scoped>
.slide-left-enter-active,
.slide-left-leave-active {
    transition: transform 0.2s ease, opacity 0.15s ease;
}
.slide-left-enter-from,
.slide-left-leave-to {
    transform: translateX(-100%);
    opacity: 0;
}
</style>
