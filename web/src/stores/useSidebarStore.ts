import { defineStore } from "pinia";
import { ref } from "vue";
import { useRegistryStore } from "./useRegistryStore";

export const useSidebarStore = defineStore("sidebar", () => {
  const expandedPlatforms = ref<string[]>([]);
  const expandedCategories = ref<string[]>([]);
  const isCollapsed = ref(false);
  const currentPlatform = ref<{ id: string; name: string } | null>(null);
  const displayedApis = ref<ReturnType<typeof useRegistryStore>["apis"]>([]);

  function togglePlatform(platformId: string) {
    const isExpanding = !expandedPlatforms.value.includes(platformId);

    if (isExpanding) {
      expandedPlatforms.value.push(platformId);
      const registry = useRegistryStore();
      currentPlatform.value = registry.getPlatformById(platformId) ?? null;
    } else {
      expandedPlatforms.value = expandedPlatforms.value.filter((id) => id !== platformId);
      const registry = useRegistryStore();
      const categoryIds = registry.getCategoriesByPlatform(platformId).map((c) => c.id);
      expandedCategories.value = expandedCategories.value.filter((id) => !categoryIds.includes(id));
      refreshDisplayedApis();
      if (currentPlatform.value?.id === platformId) {
        currentPlatform.value = null;
      }
    }
  }

  function toggleCategory(categoryId: string) {
    const isExpanding = !expandedCategories.value.includes(categoryId);

    if (isExpanding) {
      expandedCategories.value.push(categoryId);
    } else {
      expandedCategories.value = expandedCategories.value.filter((id) => id !== categoryId);
    }
    refreshDisplayedApis();
  }

  function expandAllCategories(platformId: string, expand: boolean) {
    const registry = useRegistryStore();

    if (expand) {
      if (!expandedPlatforms.value.includes(platformId)) {
        expandedPlatforms.value.push(platformId);
      }
      currentPlatform.value = registry.getPlatformById(platformId) ?? null;

      const categoryIds = registry.getCategoriesByPlatform(platformId).map((c) => c.id);
      categoryIds.forEach((id) => {
        if (!expandedCategories.value.includes(id)) {
          expandedCategories.value.push(id);
        }
      });
    } else {
      const categoryIds = registry.getCategoriesByPlatform(platformId).map((c) => c.id);
      expandedPlatforms.value = expandedPlatforms.value.filter((id) => id !== platformId);
      expandedCategories.value = expandedCategories.value.filter((id) => !categoryIds.includes(id));
      if (currentPlatform.value?.id === platformId) {
        currentPlatform.value = null;
      }
    }
    refreshDisplayedApis();
  }

  function expandToApi(apiId: string) {
    const registry = useRegistryStore();
    const api = registry.getApiById(apiId);
    if (!api) return null;

    if (api.platformId && !expandedPlatforms.value.includes(api.platformId)) {
      expandedPlatforms.value.push(api.platformId);
    }
    currentPlatform.value = registry.getPlatformById(api.platformId) ?? null;

    if (api.categoryId && !expandedCategories.value.includes(api.categoryId)) {
      expandedCategories.value.push(api.categoryId);
    }

    refreshDisplayedApis();
    return api;
  }

  function refreshDisplayedApis() {
    const registry = useRegistryStore();
    const result = [];
    for (const categoryId of expandedCategories.value) {
      const categoryApis = registry.getApisByCategory(categoryId);
      result.push(...categoryApis);
    }
    displayedApis.value = result;
  }

  function toggleCollapse() {
    isCollapsed.value = !isCollapsed.value;
  }

  return {
    expandedPlatforms,
    expandedCategories,
    isCollapsed,
    currentPlatform,
    displayedApis,
    togglePlatform,
    toggleCategory,
    expandAllCategories,
    expandToApi,
    toggleCollapse,
  };
});
