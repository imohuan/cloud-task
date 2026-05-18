import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { authApi } from "@/api";

const AUTH_TOKEN_KEY = "auth_token";
const AUTH_EXPIRES_AT_KEY = "auth_expires_at";

export const useAuthSessionStore = defineStore("authSession", () => {
  const token = ref<string>(localStorage.getItem(AUTH_TOKEN_KEY) || "");
  const expiresAt = ref<number>(Number(localStorage.getItem(AUTH_EXPIRES_AT_KEY) || 0));

  const isLoggedIn = computed(() => {
    if (!token.value || !expiresAt.value) return false;
    return Date.now() < expiresAt.value;
  });

  function setSession(nextToken: string, nextExpiresAt: number) {
    token.value = nextToken;
    expiresAt.value = nextExpiresAt;
    localStorage.setItem(AUTH_TOKEN_KEY, nextToken);
    localStorage.setItem(AUTH_EXPIRES_AT_KEY, String(nextExpiresAt));
  }

  function clearSession() {
    token.value = "";
    expiresAt.value = 0;
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_EXPIRES_AT_KEY);
  }

  async function login(password: string) {
    const res = (await authApi.login(password)) as {
      success: boolean;
      data?: { token: string; expiresAt: number };
    };
    if (!res?.data?.token || !res?.data?.expiresAt) {
      throw new Error("登录响应无效");
    }
    setSession(res.data.token, res.data.expiresAt);
  }

  async function validateSession() {
    if (!isLoggedIn.value) {
      clearSession();
      return false;
    }

    try {
      await authApi.getSession();
      return true;
    } catch {
      clearSession();
      return false;
    }
  }

  return {
    token,
    expiresAt,
    isLoggedIn,
    setSession,
    clearSession,
    login,
    validateSession,
  };
});