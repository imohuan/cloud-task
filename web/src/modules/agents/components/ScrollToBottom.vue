<template>
    <button
        v-if="show"
        type="button"
        @click="scrollToBottom"
        :class="appStore.isMobile ? 'p-2' : 'px-3 py-1.5 gap-1.5'"
        class="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center rounded-full bg-white shadow-md border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 active:scale-95 transition-all cursor-pointer z-10 select-none whitespace-nowrap"
    >
        <span v-if="!appStore.isMobile">聊天底部</span>
        <ArrowDownwardSharp class="size-3.5" />
    </button>
</template>

<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'
import { ArrowDownwardSharp } from '@vicons/material'
import { useAppStore } from '@/stores/useAppStore'

const appStore = useAppStore()

const props = defineProps<{
    scrollEl: HTMLElement | null
}>()

const show = ref(false)
const THRESHOLD = 80

function checkScroll() {
    const el = props.scrollEl
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    show.value = distanceFromBottom > THRESHOLD
}

function scrollToBottom() {
    props.scrollEl?.scrollTo({ top: props.scrollEl.scrollHeight, behavior: 'smooth' })
}

let resizeObserver: ResizeObserver | null = null
let mutationObserver: MutationObserver | null = null

function cleanup(el: HTMLElement | null) {
    if (!el) return
    el.removeEventListener('scroll', checkScroll)
    resizeObserver?.disconnect()
    resizeObserver = null
    mutationObserver?.disconnect()
    mutationObserver = null
}

function setup(el: HTMLElement | null) {
    cleanup(el)
    if (!el) return

    el.addEventListener('scroll', checkScroll, { passive: true })

    resizeObserver = new ResizeObserver(checkScroll)
    resizeObserver.observe(el)

    mutationObserver = new MutationObserver(checkScroll)
    mutationObserver.observe(el, { childList: true, subtree: true })

    checkScroll()
}

watch(() => props.scrollEl, (newEl, oldEl) => {
    cleanup(oldEl ?? null)
    setup(newEl)
}, { immediate: true })

onUnmounted(() => cleanup(props.scrollEl))
</script>

<style scoped>
</style>
