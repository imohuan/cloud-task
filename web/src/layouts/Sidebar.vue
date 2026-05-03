<template>
  <aside
    class="flex flex-shrink-0 flex-col overflow-hidden border-r border-slate-200 bg-white transition-all duration-300 ease-in-out"
    :class="[
      !isMobile && (isCollapsed ? 'w-16' : 'w-56'),
      isMobile ? 'fixed top-0 left-0 z-50 h-full w-72 transition-transform duration-300' : 'relative',
      isMobile && mobileOpen ? 'shadow-2xl' : '',
      isMobile && !mobileOpen ? '-translate-x-full' : 'translate-x-0',
    ]"
    :style="{ minWidth: !isMobile ? (isCollapsed ? '64px' : '224px') : undefined }"
  >
    <div class="mb-2 flex h-14 items-center justify-between overflow-hidden px-5">
      <div class="flex items-center">
        <div class="flex h-7 w-7 flex-shrink-0 items-center justify-center text-white">
          <!-- <FlashOnFilled class="h-4 w-4" /> -->
           <img src="/favicon.ico" alt="" class="size-10">
        </div>
        <span v-show="!isCollapsed" class="ml-3 text-base font-bold tracking-tight whitespace-nowrap">CloudTask</span>
      </div>
      <button
        v-if="isMobile"
        class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
        @click="emit('closeMobile')"
      >
        <CloseFilled class="h-4 w-4" />
      </button>
    </div>

    <nav ref="navRef" class="flex-1 space-y-1 overflow-x-hidden overflow-y-auto px-3">
      <div class="mb-4 space-y-0.5">
        <button
          :class="{ 'sidebar-item-active': currentView === 'welcome' }"
          class="ring-none flex w-full items-center gap-3 rounded-lg px-3 py-2 whitespace-nowrap text-slate-600 transition-all outline-none hover:bg-slate-50"
          @click="navigateTo('welcome')"
        >
          <HomeFilled class="h-4 w-4 shrink-0" />
          <span v-show="!isCollapsed" class="text-[13px]">工作台</span>
        </button>

        <button
          :class="{ 'sidebar-item-active': currentView === 'generator' }"
          class="ring-none flex w-full items-center gap-3 rounded-lg px-3 py-2 whitespace-nowrap text-slate-600 transition-all outline-none hover:bg-slate-50"
          @click="navigateTo('generator')"
        >
          <AutoAwesomeFilled class="h-4 w-4 shrink-0" />
          <span v-show="!isCollapsed" class="text-[13px]">对话</span>
        </button>

        <button
          :class="{ 'sidebar-item-active': currentView === 'tasks' }"
          class="group ring-none flex w-full items-center justify-between rounded-lg px-3 py-2 whitespace-nowrap text-slate-600 transition-all outline-none hover:bg-slate-50"
          @click="navigateTo('tasks')"
        >
          <div class="flex items-center gap-3">
            <TaskAltFilled class="h-4 w-4 shrink-0" />
            <span v-show="!isCollapsed" class="text-[13px]">任务中心</span>
          </div>
          <span
            v-show="!isCollapsed && (activeTasksCount ?? 0) > 0"
            class="flex size-5 items-center justify-center rounded-full bg-blue-500 text-[9px] font-bold text-white"
          >
            {{ activeTasksCount }}
          </span>
        </button>

        <button
          :class="{ 'sidebar-item-active': currentView === 'auth' }"
          class="ring-none flex w-full items-center gap-3 rounded-lg px-3 py-2 whitespace-nowrap text-slate-600 transition-all outline-none hover:bg-slate-50"
          @click="navigateTo('auth')"
        >
          <SecurityFilled class="h-4 w-4 shrink-0" />
          <span v-show="!isCollapsed" class="text-[13px]">认证管理</span>
        </button>

      </div>

      <div class="mx-3 mb-4 h-px bg-slate-100" />

      <SidebarAgentsSection
        :is-collapsed="isCollapsed"
        :current-view="currentView"
        :conversations="conversations"
        :current-conversation-id="currentConversationId"
        @navigate="navigateTo('agents')"
        @select-conversation="emit('selectConversation', $event)"
      />

      <div v-show="!isCollapsed" class="mb-2 px-3 text-[10px] font-bold tracking-widest text-slate-400 uppercase">
        API 资源库
      </div>

      <div v-for="platform in platforms" :key="platform.id" class="mb-2 select-none">
        <div
          class="group flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 hover:bg-slate-50"
          @click.stop.prevent="handlePlatformClick(platform.id, $event)"
        >
          <div class="flex items-center gap-3 select-none">
            <component
              :is="getPlatformIcon(platform)"
              class="flex h-4 w-4 shrink-0 items-center justify-center text-center text-slate-400 group-hover:text-blue-600"
            />
            <span v-show="!isCollapsed" class="text-[13px] font-bold text-slate-700 select-none">{{
              platform.name
            }}</span>
          </div>
          <ChevronRightFilled
            v-show="!isCollapsed"
            class="h-4 w-4 text-slate-500 transition-transform duration-200"
            :class="{ 'rotate-90': isPlatformExpanded(platform.id) }"
          />
        </div>

        <div v-show="isPlatformExpanded(platform.id) && !isCollapsed" class="mt-1 ml-4 border-l border-slate-100 pl-2">
          <div v-for="category in getCategoriesByPlatform(platform.id)" :key="category.id" class="mb-1">
            <div
              class="group flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 hover:bg-slate-50"
              @click.stop.prevent="handleCategoryClick(category.id)"
            >
              <div class="flex items-center gap-3 select-none">
                <FolderFilled
                  class="flex h-4 w-4 shrink-0 items-center justify-center text-center text-slate-400 group-hover:text-blue-600"
                />
                <span class="text-[13px] font-bold text-slate-700 select-none">{{ category.name }}</span>
              </div>
              <ChevronRightFilled
                class="h-4 w-4 text-slate-500 transition-transform duration-200"
                :class="{ 'rotate-90': isCategoryExpanded(category.id) }"
              />
            </div>

            <div
              v-show="isCategoryExpanded(category.id)"
              class="mt-1 ml-4 flex flex-col gap-1 border-l border-slate-100 pl-2"
            >
              <div
                v-for="api in getApisByCategory(category.id)"
                :key="api.id"
                :ref="(el) => setApiRef(el as HTMLElement, api.id)"
                :class="
                  currentView === 'api' && currentApi?.id === api.id
                    ? 'bg-blue-50 font-semibold text-blue-700'
                    : 'text-slate-500 hover:text-slate-900'
                "
                class="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-[13px] hover:bg-slate-50"
                @click="selectApi(api)"
              >
                <component
                  :is="api.executionMode === 'async' || api.isAsync ? ScheduleFilled : FlashOnFilled"
                  class="h-4 w-4 shrink-0 text-[13px] opacity-70"
                />
                <span class="truncate">{{ api.name }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </nav>
  </aside>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from "vue";
import {
  FlashOnFilled,
  HomeFilled,
  AutoAwesomeFilled,
  TaskAltFilled,
  SecurityFilled,
  ChevronRightFilled,
  FolderFilled,
  ScheduleFilled,
  CloudFilled,
  PsychologyFilled,
  CloseFilled,
} from "@vicons/material";
import SidebarAgentsSection, { type Conversation } from "./SidebarAgentsSection.vue";
import type { Component } from "vue";

interface Platform {
  id: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
  platformId: string;
}

interface ApiItem {
  id: string;
  name: string;
  platformId: string;
  categoryId: string;
  executionMode?: string;
  isAsync?: boolean;
}

const props = defineProps<{
  currentView?: string;
  currentApi?: ApiItem | null;
  isCollapsed?: boolean;
  isMobile?: boolean;
  mobileOpen?: boolean;
  platforms?: Platform[];
  categories?: Category[];
  apis?: ApiItem[];
  activeTasksCount?: number;
  expandedPlatforms?: string[];
  expandedCategories?: string[];
  conversations?: Conversation[];
  currentConversationId?: string | null;
}>();

const emit = defineEmits<{
  (e: "update:currentView", view: string): void;
  (e: "update:isCollapsed", collapsed: boolean): void;
  (e: "selectApi", api: ApiItem): void;
  (e: "togglePlatform", platformId: string): void;
  (e: "toggleCategory", categoryId: string): void;
  (e: "expandAllCategories", payload: { platformId: string; expand: boolean }): void;
  (e: "closeMobile"): void;
  (e: "selectConversation", conv: Conversation | null): void;
}>();

const navRef = ref<HTMLElement | null>(null);
const apiRefs = ref<Record<string, HTMLElement>>({});

const navigateTo = (view: string) => {
  if (props.isCollapsed && !props.isMobile) {
    emit("update:isCollapsed", false);
  }
  emit("update:currentView", view);
  if (props.isMobile) {
    emit("closeMobile");
  }
};

const getCategoriesByPlatform = (pid: string) => {
  return (props.categories || []).filter((c) => c.platformId === pid);
};

const getApisByCategory = (cid: string) => {
  return (props.apis || []).filter((a) => a.categoryId === cid);
};

const getPlatformIcon = (platform: Platform): Component => {
  const name = (platform?.name || "").toLowerCase();
  if (name.includes("openai")) return PsychologyFilled;
  return CloudFilled;
};

const isPlatformExpanded = (id: string) => (props.expandedPlatforms || []).includes(id);
const isCategoryExpanded = (id: string) => (props.expandedCategories || []).includes(id);

const handlePlatformClick = (id: string, event: MouseEvent) => {
  const isCtrlPressed = event.ctrlKey || event.metaKey;
  const platformExpanded = isPlatformExpanded(id);

  if (isCtrlPressed) {
    emit("expandAllCategories", {
      platformId: id,
      expand: !platformExpanded,
    });
  } else {
    emit("togglePlatform", id);
  }
};

const handleCategoryClick = (id: string) => {
  emit("toggleCategory", id);
};

const selectApi = (api: ApiItem) => emit("selectApi", api);

const setApiRef = (el: HTMLElement | null, apiId: string) => {
  if (el) {
    apiRefs.value[apiId] = el;
  }
};

const scrollToSelectedApi = async () => {
  if (!props.currentApi || props.isCollapsed) return;

  await nextTick();

  const selectedEl = apiRefs.value[props.currentApi.id];
  const navContainer = navRef.value;

  if (selectedEl && navContainer) {
    const containerRect = navContainer.getBoundingClientRect();
    const elRect = selectedEl.getBoundingClientRect();

    const isVisible = elRect.top >= containerRect.top && elRect.bottom <= containerRect.bottom;

    if (!isVisible) {
      const scrollTop =
        navContainer.scrollTop + elRect.top - containerRect.top - containerRect.height / 2 + elRect.height / 2;

      navContainer.scrollTo({
        top: scrollTop,
        behavior: "smooth",
      });
    }
  }
};

watch(
  () => props.currentApi?.id,
  (newId, oldId) => {
    if (newId && newId !== oldId) {
      scrollToSelectedApi();
    }
  },
);

watch(
  () => props.expandedCategories,
  () => {
    if (props.currentApi?.id) {
      setTimeout(scrollToSelectedApi, 100);
    }
  },
  { deep: true },
);

watch(
  () => props.isCollapsed,
  (collapsed) => {
    if (!collapsed && props.currentApi?.id) {
      setTimeout(scrollToSelectedApi, 300);
    }
  },
);
</script>
