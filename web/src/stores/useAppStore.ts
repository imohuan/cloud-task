import { defineStore } from "pinia";
import { ref } from "vue";
import { useMediaQuery } from "@vueuse/core";
import { useRegistryStore } from "./useRegistryStore";
import { useAuthProfileStore } from "./useAuthProfileStore";

export const useAppStore = defineStore("app", () => {
  const initialized = ref(false);
  const isMobile = useMediaQuery("(max-width: 1023px)");

  async function init() {
    if (initialized.value) return;

    const registryStore = useRegistryStore();
    const authProfileStore = useAuthProfileStore();

    await Promise.all([registryStore.fetchAll(), authProfileStore.fetchProfiles()]);
    initialized.value = true;
  }

  return {
    initialized,
    isMobile,
    init,
  };
});
