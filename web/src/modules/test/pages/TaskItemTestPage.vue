<template>
  <TestLayout title="任务项组件" description="ResourceTaskItem 组件各状态的静态预览" badge="UI" badge-color="purple">
    <TestCard title="组件预览" subtitle="含已完成、执行中、失败三种状态">
      <TaskItemDemo />
    </TestCard>
  </TestLayout>
</template>

<script setup lang="ts">
import TestLayout from "@/modules/test/components/TestLayout.vue";
import TestCard from "@/modules/test/components/TestCard.vue";
import TaskItemDemo from "@/modules/dashboard/components/TaskItemDemo.vue";
</script>
