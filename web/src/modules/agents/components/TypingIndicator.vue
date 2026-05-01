<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'

const props = defineProps<{ index?: number }>()

const MESSAGES = [
  '努力思考中',
  '脑细胞全力运转',
  '向宇宙借点智慧',
  '正在翻阅天书',
  '灵感加载中',
  '敲打键盘的声音',
  '假装很忙中',
  '让子弹飞一会儿',
  '查阅上古秘籍',
  '正在询问神明',
]

const DOTS = ['.', '..', '...']
const dotIndex = ref(0)
const label = ref(MESSAGES[Math.floor(Math.random() * MESSAGES.length)])

let autoLabelTimer: ReturnType<typeof setTimeout>

function rotateLabel() {
  label.value = MESSAGES[Math.floor(Math.random() * MESSAGES.length)]
}

function resetAutoLabel() {
  clearTimeout(autoLabelTimer)
  autoLabelTimer = setTimeout(() => {
    rotateLabel()
    resetAutoLabel()
  }, 5000)
}

watch(() => props.index, () => {
  rotateLabel()
  resetAutoLabel()
})

let timer: ReturnType<typeof setInterval>

onMounted(() => {
  timer = setInterval(() => {
    dotIndex.value = (dotIndex.value + 1) % DOTS.length
  }, 500)
  resetAutoLabel()
})

onUnmounted(() => {
  clearInterval(timer)
  clearTimeout(autoLabelTimer)
})
</script>

<template>
  <div class="flex justify-start py-1">
    <div class="flex items-baseline text-[13px] font-sans select-none tracking-tight">
      <span class="shimmer-text text-[10px]">{{ label }}</span>
      <span class="shimmer-text text-[10px] ml-0.5 w-7 tracking-[0.2em]">{{ DOTS[dotIndex] }}</span>
    </div>
  </div>
</template>

<style scoped>
@keyframes textShimmer {
  0%   { background-position: -200% center; }
  100% { background-position:  200% center; }
}

.shimmer-text {
  background-image: linear-gradient(
    90deg,
    #9ca3af 0%,
    #000000 50%,
    #9ca3af 100%
  );
  background-size: 200% auto;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: textShimmer 3s linear infinite;
}
</style>
