<template>
  <TestLayout title="Toast 通知" description="测试所有 Toast 通知类型的展示效果与动画" badge="UI" badge-color="blue">
    <TestCard title="触发测试" subtitle="点击按钮触发对应类型的 Toast 通知">
      <div class="flex flex-wrap gap-3">
        <button
          class="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 transition-all hover:bg-emerald-100 active:scale-95"
          @click="toastStore.show('操作已成功完成，数据已保存。', 'success')"
        >
          <span class="h-2 w-2 rounded-full bg-emerald-500" />
          成功
        </button>
        <button
          class="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition-all hover:bg-red-100 active:scale-95"
          @click="toastStore.show('请求失败，请检查网络连接后重试。', 'error')"
        >
          <span class="h-2 w-2 rounded-full bg-red-500" />
          错误
        </button>
        <button
          class="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 transition-all hover:bg-amber-100 active:scale-95"
          @click="toastStore.show('此操作不可逆，请谨慎操作。', 'warning')"
        >
          <span class="h-2 w-2 rounded-full bg-amber-500" />
          警告
        </button>
        <button
          class="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 transition-all hover:bg-blue-100 active:scale-95"
          @click="toastStore.show('任务正在后台处理，稍后完成。', 'info')"
        >
          <span class="h-2 w-2 rounded-full bg-blue-500" />
          提示
        </button>
      </div>
    </TestCard>

    <TestCard title="长文本测试" subtitle="测试消息文本较长时的截断行为">
      <button
        class="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 transition-all hover:bg-slate-100 active:scale-95"
        @click="toastStore.show('这是一条非常非常非常非常非常非常非常非常非常非常非常长的通知消息内容', 'info')"
      >
        触发长文本通知
      </button>
    </TestCard>

    <TestCard title="批量堆叠测试" subtitle="同时触发多条通知，测试堆叠效果">
      <button
        class="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 transition-all hover:bg-slate-100 active:scale-95"
        @click="triggerAll"
      >
        触发全部类型
      </button>
    </TestCard>

    <TestCard title="预览样式" subtitle="各类型 Toast 的静态外观预览">
      <div class="flex flex-col gap-2">
        <div
          v-for="type in (['success', 'error', 'warning', 'info'] as const)"
          :key="type"
          class="group flex min-w-[280px] items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-lg"
        >
          <component :is="icons[type]" class="h-[18px] w-[18px] shrink-0" :class="iconColorClass[type]" />
          <span class="flex-1 text-xs font-medium text-gray-800">{{ previewMsg[type] }}</span>
          <CloseFilled class="h-3.5 w-3.5 text-gray-300" />
        </div>
      </div>
    </TestCard>
  </TestLayout>

  <Toast :toasts="toastStore.toasts" @remove="toastStore.remove" />
</template>

<script setup lang="ts">
import { CheckCircleOutlined, CancelOutlined, WarningAmberFilled, InfoOutlined, CloseFilled } from "@vicons/material";
import TestLayout from "@/modules/test/components/TestLayout.vue";
import TestCard from "@/modules/test/components/TestCard.vue";
import Toast from "@/components/Toast.vue";
import { useToastStore } from "@/stores";

const toastStore = useToastStore();

const triggerAll = () => {
  toastStore.show("操作已成功完成。", "success");
  setTimeout(() => toastStore.show("请求失败，请重试。", "error"), 150);
  setTimeout(() => toastStore.show("此操作不可逆，请谨慎。", "warning"), 300);
  setTimeout(() => toastStore.show("任务正在后台处理中。", "info"), 450);
};

const icons = {
  success: CheckCircleOutlined,
  error: CancelOutlined,
  warning: WarningAmberFilled,
  info: InfoOutlined,
};

const previewMsg: Record<string, string> = {
  success: "操作已成功完成，数据已保存。",
  error: "请求失败，请检查网络连接后重试。",
  warning: "此操作不可逆，请谨慎操作。",
  info: "任务正在后台处理，稍后完成。",
};

const iconColorClass: Record<string, string> = {
  success: "text-emerald-500",
  error: "text-red-500",
  warning: "text-amber-500",
  info: "text-blue-500",
};
</script>
