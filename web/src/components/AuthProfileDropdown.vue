<template>
  <Dropdown :is-open="isOpen" placement="bottom-end" @update:is-open="isOpen = $event">
    <template #trigger>
      <button
        class="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-600 transition-colors hover:bg-slate-50"
      >
        <i class="fa-solid fa-key text-[10px] text-slate-400"></i>
        <span class="max-w-[140px] truncate">{{ selectedProfileLabel }}</span>
        <i class="fa-solid fa-chevron-down text-[10px] text-slate-400"></i>
      </button>
    </template>
    <template #default>
      <div class="max-h-72 w-56 overflow-y-auto p-1.5">
        <div v-if="!profilesByPlatform.length" class="px-3 py-2 text-xs text-slate-400">暂无认证配置</div>
        <template v-else>
          <template v-for="group in profilesByPlatform" :key="group.id">
            <div class="px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-slate-400">
              {{ group.name }}
            </div>
            <button
              v-for="profile in group.profiles"
              :key="profile.id"
              class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-slate-50"
              :class="authStore.selectedProfileId === profile.id ? 'bg-blue-50 text-blue-700' : 'text-slate-600'"
              @click="selectAndClose(profile.id)"
            >
              <i
                class="fa-solid fa-circle-dot text-[10px]"
                :class="authStore.selectedProfileId === profile.id ? 'text-blue-500' : 'text-slate-300'"
              ></i>
              <span class="truncate">{{ profile.name }}</span>
            </button>
          </template>
        </template>
      </div>
    </template>
  </Dropdown>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import Dropdown from "@/components/dropdown/Dropdown.vue";
import { useAuthProfileStore } from "@/stores/useAuthProfileStore";
import { useRegistryStore } from "@/stores/useRegistryStore";

const authStore = useAuthProfileStore();
const registryStore = useRegistryStore();

const isOpen = ref(false);

onMounted(() => {
  if (!authStore.profiles.length) authStore.fetchProfiles();
});

const selectedProfileLabel = computed(() => {
  const id = authStore.selectedProfileId;
  const profile = authStore.profiles.find((p) => p.id === id) || authStore.currentProfile;
  if (!profile) return "选择认证";
  const platform = (registryStore.platforms as any[]).find((p: any) => p.id === profile.platformId);
  const platformName = platform?.name || (profile.platformId as string) || "";
  return platformName ? `${platformName} - ${profile.name}` : profile.name as string;
});

const profilesByPlatform = computed(() => {
  const map = new Map<string, { id: string; name: string; profiles: any[] }>();
  for (const profile of authStore.profiles) {
    const pid = (profile.platformId as string) || "";
    if (!map.has(pid)) {
      const platform = (registryStore.platforms as any[]).find((p: any) => p.id === pid);
      map.set(pid, { id: pid, name: platform?.name || pid || "未知平台", profiles: [] });
    }
    map.get(pid)!.profiles.push(profile);
  }
  return Array.from(map.values());
});

function selectAndClose(id: string) {
  authStore.selectProfile(id);
  isOpen.value = false;
}
</script>
