<template>
  <div class="flex h-screen overflow-hidden">
    <!-- Mobile Sidebar Overlay -->
    <div v-if="isMobile && mobileMenuOpen" class="fixed inset-0 z-40 bg-black/50 lg:hidden"
      @click="mobileMenuOpen = false" />

    <Sidebar :current-view="currentView" :current-api="currentApi"
      :is-collapsed="isMobile ? false : sidebarStore.isCollapsed" :is-mobile="isMobile" :mobile-open="mobileMenuOpen"
      :platforms="registryStore.platforms" :categories="registryStore.categories" :apis="sidebarStore.displayedApis"
      :active-tasks-count="taskStore.activeTasksCount" :expanded-platforms="sidebarStore.expandedPlatforms"
      :expanded-categories="sidebarStore.expandedCategories" :conversations="agentsStore.conversations"
      :current-conversation-id="agentsStore.currentConversationId" @update:current-view="handleMobileNavigate($event)"
      @update:is-collapsed="sidebarStore.isCollapsed = $event" @toggle-platform="sidebarStore.togglePlatform($event)"
      @toggle-category="sidebarStore.toggleCategory($event)" @expand-all-categories="handleExpandAllCategories"
      @select-api="handleSelectApi" @close-mobile="mobileMenuOpen = false"
      @select-conversation="handleSelectConversation"
      @delete-conversation="handleDeleteConversation" />

    <main class="flex min-w-0 flex-1 flex-col">
      <header class="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 lg:px-6">
        <div class="flex items-center gap-4">
          <button
            class="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
            @click="isMobile ? (mobileMenuOpen = true) : sidebarStore.toggleCollapse()">
            <MenuFilled class="h-4 w-4" />
          </button>
          <nav class="flex items-center text-xs text-slate-400">
            <span v-if="currentView === 'welcome'">工作台</span>
            <span v-else-if="currentView === 'tasks'">任务中心</span>
            <span v-else-if="currentView === 'auth'">认证管理</span>
            <span v-else-if="currentView === 'agents'">Agents</span>
            <span v-else-if="currentView === 'generator'">对话</span>
            <template v-else-if="currentView === 'api'">
              <span class="text-slate-400">{{ sidebarStore.currentPlatform?.name }}</span>
              <ChevronRightFilled class="mx-2 h-2 w-2" />
              <span class="font-medium text-slate-600">{{ currentApi?.name }}</span>
            </template>
          </nav>
        </div>
        <div class="flex items-center gap-3">
          <div v-if="registryStore.loading" class="text-xs text-slate-400">
            <RefreshFilled class="mr-1 inline h-3 w-3 animate-spin" />加载中...
          </div>
          <button
            v-if="currentView === 'agents'"
            class="flex h-8 items-center justify-center rounded-lg bg-blue-50 px-3 text-xs text-blue-600 transition-colors hover:bg-blue-100"
            title="新建对话"
            @click="handleSelectConversation(null)"
          >
            <AddCommentFilled class="mr-1.5 h-3 w-3" />新建对话
          </button>
          <AuthProfileDropdown v-if="currentView === 'agents'" />
          <div id="generator-header-slot" class="flex items-center gap-2"></div>
          <a v-if="currentView !== 'agents'" href="/logs" target="_blank"
            class="flex h-8 items-center justify-center rounded-lg bg-slate-100 px-3 text-xs text-slate-600 transition-colors hover:bg-slate-200">
            <DescriptionFilled class="mr-1.5 h-3 w-3" />日志
          </a>
          <!-- <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <AdminPanelSettingsFilled class="h-4 w-4" />
          </div> -->
        </div>
      </header>

      <div class="flex-1 overflow-y-auto bg-slate-50/40 overflow-x-hidden">
        <RouterView v-slot="{ Component }">
          <Transition name="fade-slide" mode="out-in">
            <component :is="Component" />
          </Transition>
        </RouterView>
      </div>
    </main>
  </div>

  <TaskDetail :task-id="currentTaskId" @close="currentTaskId = null" @recreate-task="handleRecreateTask"
    @open-api-form="handleOpenApiForm" />

  <AuthConfigModal :visible="isAuthConfigVisible" :platforms="registryStore.platforms"
    @close="isAuthConfigVisible = false" @save="saveAuthConfig" />

  <Toast :toasts="toastStore.toasts" @remove="toastStore.remove" />
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick, provide, reactive } from "vue";
import { useRouter, useRoute } from "vue-router";
import { MenuFilled, ChevronRightFilled, RefreshFilled, DescriptionFilled, AddCommentFilled } from "@vicons/material";
import Sidebar from "@/layouts/Sidebar.vue";
import TaskDetail from "@/modules/task/components/TaskDetail.vue";
import AuthConfigModal from "@/modules/auth/components/AuthConfigModal.vue";
import Toast from "@/components/Toast.vue";
import AuthProfileDropdown from "@/components/AuthProfileDropdown.vue";
import {
  useRegistryStore,
  useAuthProfileStore,
  useTaskStore,
  useSidebarStore,
  useAppStore,
  useToastStore,
  useAgentsStore,
} from "@/stores";
import type { Conversation } from "@/layouts/SidebarAgentsSection.vue";
import { invokeApi, taskApi } from "@/api";
import { useTaskSseRefresh } from "@/modules/task/composables/useTaskSseRefresh";

const registryStore = useRegistryStore();
const authProfileStore = useAuthProfileStore();
const taskStore = useTaskStore();
const sidebarStore = useSidebarStore();
const agentsStore = useAgentsStore();
const appStore = useAppStore();
const toastStore = useToastStore();
const showToast = toastStore.show;
const router = useRouter();
const route = useRoute();

const currentView = computed(() => (route.name as string) || "welcome");
const currentApi = ref<any>(null);
const isSubmitting = ref(false);
const lastResult = ref<any>(null);
const isAuthConfigVisible = ref(false);
const currentTaskId = ref<string | null>(null);
const prefilledFormData = ref<any>(null);
const mobileMenuOpen = ref(false);
const isMobile = computed(() => appStore.isMobile);

const handleSelectConversation = (conv: Conversation | null) => {
  agentsStore.selectConversation(conv?.id ?? null);
  router.push({ name: "agents", query: { threadId: conv?.id || undefined } });
  if (isMobile.value) {
    mobileMenuOpen.value = false;
  }
};

const handleDeleteConversation = (id: string) => {
  agentsStore.deleteThread(id);
};

const handleMobileNavigate = (view: string) => {
  router.push({ name: view });
  if (isMobile.value) {
    mobileMenuOpen.value = false;
  }
};

const taskSse = useTaskSseRefresh(taskStore, currentView, { debounceMs: 500 });

onMounted(async () => {
  await appStore.init();
  window.addEventListener("keydown", handleKeydown);
  await taskSse.start();
  agentsStore.fetchThreads();
  agentsStore.fetchAssistants();
});

onUnmounted(() => {
  window.removeEventListener("keydown", handleKeydown);
  taskSse.stop();
});

let unwatchTaskInit: ReturnType<typeof watch> | undefined;
unwatchTaskInit = watch(
  () => currentView.value,
  (view) => {
    if (view === "generator" || view === "tasks") {
      if (taskStore.tasks.length === 0) {
        taskStore.fetchTasks();
      }
      nextTick(() => unwatchTaskInit?.());
    }
  },
  { immediate: true },
);

const handleExpandAllCategories = ({ platformId, expand }: { platformId: string; expand: boolean }) => {
  sidebarStore.expandAllCategories(platformId, expand);
};

const handleSelectApi = async (api: any) => {
  router.push({ name: "api" });
  currentApi.value = api;
  lastResult.value = null;

  const detail = await registryStore.fetchApiDetail(api.id);
  if (detail) {
    currentApi.value = detail;
  }
};

const submitApiCall = async ({
  authProfileId,
  input,
}: {
  authProfileId: string | null;
  input: Record<string, unknown>;
}) => {
  isSubmitting.value = true;
  try {
    const apiId = currentApi.value.id;

    if (currentApi.value.executionMode === "async" || currentApi.value.isAsync) {
      const res = (await taskApi.createTask(apiId, authProfileId!, input)) as any;
      const taskId = res.id || res.taskId || res.data?.taskId;
      lastResult.value = { success: true, taskId, data: res };
      showToast("任务已创建并进入中心", "success");
      taskStore.fetchTasks();
    } else {
      const res = (await invokeApi.invokeSync(apiId, authProfileId!, input)) as any;
      lastResult.value = { success: true, data: res.data || res };
      showToast("调用成功", "success");
    }
  } catch (e: any) {
    lastResult.value = { success: false, error: e.message };
    showToast(e.message, "error");
  } finally {
    isSubmitting.value = false;
  }
};

const resetApiForm = () => {
  lastResult.value = null;
};

const saveAuthConfig = async (data: any, onSuccess?: () => void) => {
  try {
    await authProfileStore.createProfile(data);
    showToast("认证配置已保存", "success");
    onSuccess?.();
  } catch (e: any) {
    showToast(e.message, "error");
  }
};

const updateAuthConfig = async ({ id, data }: { id: string; data: any }, onSuccess?: () => void) => {
  try {
    await authProfileStore.updateProfile(id, data);
    showToast("认证配置已更新", "success");
    onSuccess?.();
  } catch (e: any) {
    showToast(e.message, "error");
  }
};

const deleteAuthConfig = async (id: string) => {
  try {
    await authProfileStore.deleteProfile(id);
    showToast("认证配置已删除", "success");
  } catch (e: any) {
    showToast(e.message, "error");
  }
};

const fetchAuthDetail = async (id: string) => {
  try {
    await authProfileStore.fetchProfileById(id);
  } catch (e: any) {
    showToast(e.message, "error");
  }
};

const refreshTasks = async () => {
  showToast("任务状态同步中...", "info");
  await taskStore.fetchTasks();
};

const handlePageChange = (page: number) => {
  taskStore.fetchTasks(page);
};

const handlePageSizeChange = (pageSize: number) => {
  taskStore.pagination.pageSize = pageSize;
  taskStore.fetchTasks(1, pageSize);
};

const handleFilterChange = (filters: { search: string; status: string; startDate: string; endDate: string }) => {
  taskStore.filters.search = filters.search;
  taskStore.filters.status = filters.status;
  taskStore.filters.startDate = filters.startDate;
  taskStore.filters.endDate = filters.endDate;
  taskStore.fetchTasks(1);
};

const resolveTaskDetail = async (data: any) => {
  if (data.input !== undefined) {
    return {
      apiId: data.apiId,
      authProfileId: data.authProfileId,
      input: data.input,
    };
  }
  const taskId = data.id || data.taskId;
  const res = (await taskApi.getTask(taskId)) as any;
  const detail = res?.data ?? res;
  return {
    apiId: detail.apiId,
    authProfileId: detail.authProfileId,
    input: detail.input,
  };
};

const handleRecreateTask = async (data: any) => {
  try {
    const { apiId, authProfileId, input } = await resolveTaskDetail(data);
    await taskApi.createTask(apiId, authProfileId, input);
    showToast("任务已重新创建", "success");
    await taskStore.fetchTasks();
    currentTaskId.value = null;
    router.push({ name: "tasks" });
  } catch (e: any) {
    showToast(e.message || "重新创建任务失败", "error");
  }
};

const handleOpenApiForm = async (data: any) => {
  try {
    const { apiId, authProfileId, input } = await resolveTaskDetail(data);
    currentTaskId.value = null;

    const api = sidebarStore.expandToApi(apiId);
    if (!api) {
      showToast("无法找到对应的 API 配置", "error");
      return;
    }

    if (api.platformId && authProfileId) {
      const platformAuthExists = authProfileStore.profiles.some(
        (p) => p.platformId === api.platformId && p.id === authProfileId,
      );
      if (!platformAuthExists) {
        await authProfileStore.fetchProfiles();
      }
    }

    prefilledFormData.value = { authProfileId, input };

    const detail = await registryStore.fetchApiDetail(api.id);
    currentApi.value = detail || api;
    router.push({ name: "api" });

    showToast("已加载任务配置到表单", "success");
  } catch (e: any) {
    showToast(e.message || "打开表单失败", "error");
  }
};

provide(
  "layoutContext",
  reactive({
    currentApi,
    isSubmitting,
    lastResult,
    prefilledFormData,
    setCurrentTaskId: (id: string | null) => {
      currentTaskId.value = id;
    },
    clearPrefilledFormData: () => {
      prefilledFormData.value = null;
    },
    handleRecreateTask,
    handleOpenApiForm,
    submitApiCall,
    resetApiForm,
    saveAuthConfig,
    updateAuthConfig,
    deleteAuthConfig,
    fetchAuthDetail,
    refreshTasks,
    handlePageChange,
    handlePageSizeChange,
    handleFilterChange,
  }),
);

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === "Tab" && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
    const tagName = document.activeElement?.tagName;
    if (tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT") return;
    e.preventDefault();
    sidebarStore.toggleCollapse();
  }
};
</script>

<style>
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.25s ease;
}

.fade-slide-enter-from {
  opacity: 0;
  transform: translateX(10px);
}

.fade-slide-leave-to {
  opacity: 0;
  transform: translateX(-10px);
}
</style>
