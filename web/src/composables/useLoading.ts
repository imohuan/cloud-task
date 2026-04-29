import { ref } from "vue";

export function useLoading() {
  const loading = ref(false);

  const withLoading = async <T>(asyncFn: () => Promise<T>): Promise<T> => {
    loading.value = true;
    try {
      return await asyncFn();
    } finally {
      loading.value = false;
    }
  };

  return {
    loading,
    withLoading,
  };
}

export default useLoading;
