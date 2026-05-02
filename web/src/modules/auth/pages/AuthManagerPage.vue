<template>
  <div class="p-3 lg:p-6">
  <AuthManager
    :profiles="authProfileStore.profiles"
    :platforms="registryStore.platforms"
    :loading="authProfileStore.loading"
    :detail-loading="authProfileStore.detailLoading"
    :save-loading="authProfileStore.saveLoading"
    :current-profile="authProfileStore.currentProfile"
    @save="ctx.saveAuthConfig"
    @update="ctx.updateAuthConfig"
    @delete="ctx.deleteAuthConfig"
    @refresh="authProfileStore.fetchProfiles()"
    @fetch-detail="ctx.fetchAuthDetail"
  />
  </div>
</template>

<script setup lang="ts">
import { inject } from "vue";
import { useAuthProfileStore, useRegistryStore } from "@/stores";
import AuthManager from "@/modules/auth/components/AuthManager.vue";

const authProfileStore = useAuthProfileStore();
const registryStore = useRegistryStore();
const ctx = inject<Record<string, any>>("layoutContext")!;
</script>
