import { ref } from "vue";

export function useDropdown() {
  const activeDropdown = ref<string | null>(null);

  function toggleDropdown(key: string) {
    activeDropdown.value = activeDropdown.value === key ? null : key;
  }

  function closeDropdown() {
    activeDropdown.value = null;
  }

  return { activeDropdown, toggleDropdown, closeDropdown };
}
