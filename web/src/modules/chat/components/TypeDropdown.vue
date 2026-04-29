<template>
  <Dropdown placement="top-start" :is-open="isOpen" @update:is-open="$emit('update:is-open', $event)">
    <template #trigger="{ isOpen: openState }">
      <button
        class="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 font-medium text-cyan-500 transition-all hover:bg-slate-50"
      >
        <span
          v-if="currentType?.iconHtml"
          v-html="currentType?.iconHtml"
          class="flex size-5 items-center justify-center"
        ></span>
        <svg
          v-else
          xmlns="http://www.w3.org/2000/svg"
          class="size-5 text-cyan-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="M21 15l-5-5L5 21" />
        </svg>
        <span>{{ currentType?.label || "选择平台" }}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="size-5 text-slate-400 transition-transform"
          :class="{ 'rotate-180': openState }"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    </template>
    <template #default="{ close }">
      <div class="w-48 rounded-2xl border border-slate-100 bg-white p-2 shadow">
        <div class="mb-1 px-3 py-1 text-[10px] text-slate-400">选择平台</div>
        <Dropdown
          v-for="item in platforms"
          :key="item.id"
          placement="right"
          :offset="12"
          use-hover
          :is-open="activeId === item.id"
          @update:is-open="
            (v: boolean) => {
              if (v) setActiveId(item.id);
              else if (activeId === item.id) setActiveId(null);
            }
          "
          class="w-full"
        >
          <template #trigger="{ isOpen: subOpen }">
            <div
              class="flex cursor-pointer items-center justify-between rounded-xl px-3 py-2.5 transition-colors"
              :class="[
                subOpen ? 'bg-slate-100' : '',
                currentType?.platformId === item.id ? 'bg-slate-50' : 'hover:bg-slate-50',
              ]"
            >
              <div class="flex items-center gap-3">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="size-5 text-slate-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"
                  />
                </svg>
                <span class="text-sm font-medium text-slate-700">{{ item.name }}</span>
              </div>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="size-4 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </template>
          <template #default="{ close: closeSub }">
            <div class="w-48 rounded-2xl border border-slate-100 bg-white p-2 shadow">
              <div class="mb-1 px-3 py-1 text-[10px] text-slate-400">{{ item.name }}</div>
              <div
                v-for="cat in registryStore.getCategoriesByPlatform(item.id)"
                :key="cat.id"
                class="flex cursor-pointer items-center justify-between rounded-xl px-3 py-2.5 transition-colors hover:bg-slate-50"
                @click="selectCategory(cat, item, closeSub, close)"
              >
                <div class="flex items-center gap-3">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="size-5 text-slate-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                    />
                  </svg>
                  <span class="text-sm font-medium text-slate-700">{{ cat.name }}</span>
                </div>
                <svg
                  v-if="currentType?.id === cat.id"
                  xmlns="http://www.w3.org/2000/svg"
                  class="size-4 text-slate-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2.5"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div
                v-if="registryStore.getCategoriesByPlatform(item.id).length === 0"
                class="px-3 py-4 text-center text-xs text-slate-400"
              >
                暂无分类
              </div>
            </div>
          </template>
        </Dropdown>
        <div v-if="platforms.length === 0" class="px-3 py-4 text-center text-xs text-slate-400">加载中...</div>
      </div>
    </template>
  </Dropdown>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import Dropdown from "@/components/dropdown/Dropdown.vue";
import { useRegistryStore } from "@/stores/useRegistryStore";

interface TypeItem {
  id: string;
  label?: string;
  platformId?: string;
  platformName?: string;
  categoryId?: string;
  iconHtml?: string;
}

interface Platform {
  id: string;
  name: string;
}

const props = defineProps<{
  types?: TypeItem[];
  currentType?: TypeItem;
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: "update:is-open", v: boolean): void;
  (e: "select", type: TypeItem): void;
}>();

const registryStore = useRegistryStore();
const activeId = ref<string | null>(null);

watch(
  () => props.isOpen,
  (v) => {
    if (!v) activeId.value = null;
  },
);

const platforms = computed(() => registryStore.platforms as Platform[]);

function selectCategory(category: any, platform: any, closeSub: () => void, closeMain: () => void) {
  const type: TypeItem = {
    id: category.id,
    label: category.name,
    platformId: category.platformId,
    platformName: platform.name,
    categoryId: category.id,
  };
  emit("select", type);
  closeSub();
  closeMain();
}

function setActiveId(id: string | null) {
  activeId.value = id;
}
</script>
