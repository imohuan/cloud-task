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
      data?: { token?: unknown; expiresAt?: unknown };
    };
    const session = res.data;
    if (!session || typeof session.token !== "string" || typeof session.expiresAt !== "number") {
      throw new Error("登录响应无效");
    }
    setSession(session.token, session.expiresAt);
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