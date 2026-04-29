<template>
  <div class="mx-auto max-w-4xl">
    <h3 class="mb-4 text-sm font-bold text-slate-700">任务项组件预览</h3>
    <div class="space-y-4">
      <ResourceTaskItem
        v-for="task in demoTasks"
        :key="task.taskId"
        :task="task"
        @use-prompt="(p) => console.log('use-prompt', p)"
        @regenerate="(task) => console.log('regenerate', task)"
        @delete="(id) => console.log('delete', id)"
        @quote-task="(task) => console.log('quote-task', task)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import ResourceTaskItem from "@/modules/chat/components/ResourceTaskItem.vue";

const demoTasks = [
  {
    taskId: "demo-001",
    apiId: "demo-image-api",
    status: "completed",
    input: {
      prompt: "一只戴着墨镜的橘猫，坐在沙滩椅上，背景是蔚蓝的大海和椰子树，卡通风格",
      model: "dall-e-3",
      resolution: "1024x1024",
      referenceImages: [
        "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=100&h=100&fit=crop",
        "https://images.unsplash.com/photo-1574158622682-e40e69881006?w=100&h=100&fit=crop",
      ],
    },
    output: {
      content: [
        {
          type: "image",
          url: "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=400&h=300&fit=crop",
        },
        {
          type: "image",
          url: "https://images.unsplash.com/photo-1574158622682-e40e69881006?w=400&h=300&fit=crop",
        },
      ],
    },
    elapsed: "2.3s",
    completedAt: new Date().toISOString(),
  },
  {
    taskId: "demo-002",
    apiId: "demo-video-api",
    status: "running",
    input: {
      prompt: "赛博朋克风格的城市夜景，霓虹灯光，雨中街道，4K 画质",
      model: "sora",
      resolution: "1920x1080",
    },
    output: { content: [] },
  },
  {
    taskId: "demo-003",
    apiId: "demo-audio-api",
    status: "failed",
    input: {
      prompt: "生成一段轻快的钢琴曲，用于咖啡厅背景音乐",
      model: "sun",
    },
    output: { content: [] },
    error: "请求参数无效：不支持的音乐风格描述，请使用古典、爵士、流行等标准分类。",
  },
  {
    taskId: "demo-004",
    apiId: "demo-image-api",
    status: "completed",
    input: {
      prompt: "极简主义 Logo 设计，蓝色渐变，科技风格",
      model: "midjourney",
    },
    output: {
      content: [
        {
          type: "text",
          text: "设计概念：采用圆形构图，中心为抽象的几何图形，外围环绕公司名称。",
        },
      ],
    },
    elapsed: "5.1s",
    completedAt: new Date(Date.now() - 3600000).toISOString(),
  },
];
</script>
