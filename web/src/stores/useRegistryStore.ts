import { defineStore } from "pinia";
import { ref } from "vue";
import { registryApi } from "@/api";
import { useLoading } from "@/composables/useLoading";

export interface Platform {
  id: string;
  name: string;
  [key: string]: unknown;
}

export interface Category {
  id: string;
  name: string;
  platformId: string;
  [key: string]: unknown;
}

export interface ApiItem {
  id: string;
  name: string;
  platformId: string;
  categoryId: string;
  executionMode?: string;
  isAsync?: boolean;
  [key: string]: unknown;
}

export interface AuthStrategy {
  id: string;
  platformId: string;
  [key: string]: unknown;
}

export const useRegistryStore = defineStore("registry", () => {
  const platforms = ref<Platform[]>([]);
  const categories = ref<Category[]>([]);
  const apis = ref<ApiItem[]>([]);
  const authStrategies = ref<AuthStrategy[]>([]);
  const loaded = ref(false);
  const loader = useLoading();

  function getCategoriesByPlatform(platformId: string) {
    return categories.value.filter((c) => c.platformId === platformId);
  }

  function getApisByCategory(categoryId: string) {
    return apis.value.filter((a) => a.categoryId === categoryId);
  }

  function getApisByPlatform(platformId: string) {
    return apis.value.filter((a) => a.platformId === platformId);
  }

  function getAuthStrategiesByPlatform(platformId: string) {
    return authStrategies.value.filter((s) => s.platformId === platformId);
  }

  function getPlatformById(platformId: string) {
    return platforms.value.find((p) => p.id === platformId);
  }

  function getApiById(apiId: string) {
    return apis.value.find((a) => a.id === apiId);
  }

  function getApiNameById(apiId: string) {
    return apis.value.find((a) => a.id === apiId)?.name;
  }

  async function fetchAll() {
    if (loaded.value) return;

    await loader.withLoading(async () => {
      const res = (await registryApi.getAll()) as {
        data?: {
          platforms?: Array<
            Platform & {
              categories?: Array<Category & { apis?: ApiItem[] }>;
              authStrategies?: AuthStrategy[];
            }
          >;
        };
      };
      const rawPlatforms = res?.data?.platforms || [];

      const _platforms: Platform[] = [];
      const _categories: Category[] = [];
      const _apis: ApiItem[] = [];
      const _authStrategies: AuthStrategy[] = [];

      for (const platform of rawPlatforms) {
        const { categories: pCategories, authStrategies: pStrategies, ...platformData } = platform;
        _platforms.push(platformData as Platform);

        for (const category of pCategories || []) {
          const { apis: cApis, ...categoryData } = category;
          _categories.push({ ...categoryData, platformId: platform.id });

          for (const api of cApis || []) {
            _apis.push({ ...api, platformId: platform.id, categoryId: category.id });
          }
        }

        for (const strategy of pStrategies || []) {
          _authStrategies.push({ ...strategy, platformId: platform.id });
        }
      }

      platforms.value = _platforms;
      categories.value = _categories;
      apis.value = _apis;
      authStrategies.value = _authStrategies;
      loaded.value = true;
    });
  }

  async function fetchApiDetail(apiId: string) {
    return await loader.withLoading(async () => {
      const res = (await registryApi.getApiDetail(apiId)) as { data?: unknown };
      return res?.data ?? res;
    });
  }

  return {
    platforms,
    categories,
    apis,
    authStrategies,
    loading: loader.loading,
    loaded,
    getCategoriesByPlatform,
    getApisByCategory,
    getApisByPlatform,
    getAuthStrategiesByPlatform,
    getPlatformById,
    getApiById,
    getApiNameById,
    fetchAll,
    fetchApiDetail,
  };
});
