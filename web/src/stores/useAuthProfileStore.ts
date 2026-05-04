import { defineStore } from "pinia";
import { ref, computed, watch } from "vue";
import { useStorage } from "@vueuse/core";
import { authProfileApi } from "@/api";
import { useLoading } from "@/composables/useLoading";

export interface AuthProfile {
  id: string;
  platformId: string;
  name: string;
  apiKey?: string;
  credentials?: { apiKey?: string; baseUrl?: string };
  config?: { apiKey?: string; baseUrl?: string };
  baseUrl?: string;
  [key: string]: unknown;
}

export const useAuthProfileStore = defineStore("authProfile", () => {
  const profiles = ref<AuthProfile[]>([]);
  const currentProfile = ref<AuthProfile | null>(null);
  const selectedProfileId = useStorage('auth-profile-selected-id', '');

  const selectedProfile = computed(() =>
    profiles.value.find((p) => p.id === selectedProfileId.value) || null,
  );

  function selectProfile(id: string) {
    selectedProfileId.value = id;
  }

  watch(
    profiles,
    (newProfiles) => {
      if (!newProfiles.length) return;
      const exists = newProfiles.some((p) => p.id === selectedProfileId.value);
      if (!exists) {
        selectedProfileId.value = newProfiles[0]?.id || '';
      }
    },
    { immediate: true },
  );

  const listLoader = useLoading();
  const detailLoader = useLoading();
  const saveLoader = useLoading();

  async function fetchProfiles() {
    await listLoader.withLoading(async () => {
      const res = (await authProfileApi.getProfiles()) as { data?: AuthProfile[] };
      profiles.value = res?.data || [];
    });
  }

  async function fetchProfileById(id: string) {
    await detailLoader.withLoading(async () => {
      const res = (await authProfileApi.getProfile(id)) as { data?: AuthProfile };
      currentProfile.value = (res?.data ?? res ?? null) as AuthProfile | null;
    });
    return currentProfile.value;
  }

  async function createProfile(data: unknown) {
    const created = await saveLoader.withLoading(async () => {
      const res = (await authProfileApi.createProfile(data)) as { data?: AuthProfile };
      return res?.data ?? res;
    });
    await fetchProfiles();
    return created;
  }

  async function updateProfile(id: string, data: unknown) {
    await saveLoader.withLoading(async () => {
      await authProfileApi.updateProfile(id, data);
    });
    await fetchProfiles();
  }

  async function deleteProfile(id: string) {
    await saveLoader.withLoading(async () => {
      await authProfileApi.deleteProfile(id);
    });
    await fetchProfiles();
  }

  function getProfilesByPlatform(platformId: string) {
    return profiles.value.filter((p) => p.platformId === platformId);
  }

  return {
    profiles,
    currentProfile,
    selectedProfileId,
    selectedProfile,
    loading: listLoader.loading,
    detailLoading: detailLoader.loading,
    saveLoading: saveLoader.loading,
    fetchProfiles,
    fetchProfileById,
    createProfile,
    updateProfile,
    deleteProfile,
    getProfilesByPlatform,
    selectProfile,
  };
});
