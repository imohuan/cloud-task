<script setup lang="ts"></script>

<template>
  <div class="flex justify-start py-1">
    <div class="flex items-baseline gap-0.5 text-[13px] font-sans select-none">
      <span class="shimmer-text">思考中</span>
      <span v-for="i in [0, 1, 2]" :key="i" class="dot text-text-tertiary" :style="{ animationDelay: `${i * 220}ms` }">.</span>
    </div>
  </div>
</template>

<style scoped>
.shimmer-text {
  background: linear-gradient(
    90deg,
    var(--color-text-tertiary) 0%,
    var(--color-text-tertiary) 30%,
    #ffffff 50%,
    var(--color-text-tertiary) 70%,
    var(--color-text-tertiary) 100%
  );
  background-size: 200% auto;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: shimmer 2s linear infinite;
}

@keyframes shimmer {
  from { background-position: 200% center; }
  to   { background-position: -200% center; }
}

.dot {
  display: inline-block;
  animation: dot-fade 1.2s ease-in-out infinite;
  opacity: 0;
}

@keyframes dot-fade {
  0%, 100% { opacity: 0; }
  50%       { opacity: 1; }
}
</style>
