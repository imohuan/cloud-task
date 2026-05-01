<script setup lang="ts">
import { ref } from 'vue'
import { ErrorOutlineSharp, CloseSharp } from '@vicons/material'

const props = defineProps<{ error: unknown }>()
const emit = defineEmits<{ dismiss: [] }>()

const dismissed = ref(false)

const message = props.error instanceof Error ? props.error.message : String(props.error)

function dismiss() {
  dismissed.value = true
  emit('dismiss')
}
</script>

<template>
  <Transition name="banner">
    <div
      v-if="!dismissed"
      class="flex items-start gap-2.5 px-3.5 py-2.5 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/50 text-sm"
    >
      <ErrorOutlineSharp class="w-4 h-4 mt-0.5 shrink-0 text-red-500 dark:text-red-400" />

      <div class="flex-1 min-w-0">
        <p class="font-medium text-red-700 dark:text-red-300 leading-snug">出错了</p>
        <p class="text-red-600/80 dark:text-red-400/80 text-xs mt-0.5 wrap-break-word leading-relaxed">{{ message }}</p>
      </div>

      <button
        type="button"
        @click="dismiss"
        class="shrink-0 p-0.5 rounded text-red-400 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors cursor-pointer"
      >
        <CloseSharp class="w-3.5 h-3.5" />
      </button>
    </div>
  </Transition>
</template>

<style scoped>
.banner-enter-active,
.banner-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.banner-enter-from,
.banner-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
