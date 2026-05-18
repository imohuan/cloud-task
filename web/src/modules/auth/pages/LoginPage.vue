<template>
  <div class="login-page">
    <div class="login-bg">
      <div class="login-glow login-glow-left"></div>
      <div class="login-glow login-glow-right"></div>
      <div class="login-grid"></div>
    </div>

    <section class="login-shell">
      <aside class="login-brand">
        <div class="brand-badge">
          <span class="brand-dot"></span>
          <span>Cloud Task Console</span>
        </div>

        <h1 class="brand-title">安全访问入口</h1>
        <p class="brand-subtitle">
          统一接入第三方平台能力，先完成访问验证再进入工作区。
        </p>

        <ul class="brand-points">
          <li>会话自动过期，降低长时暴露风险</li>
          <li>接口侧统一鉴权，未授权请求自动拦截</li>
          <li>过期后自动回到登录页并保留跳转地址</li>
        </ul>
      </aside>

      <div class="login-card">
        <div class="card-header">
          <h2>登录 Cloud Task</h2>
          <p>请输入访问密码继续。</p>
        </div>

        <form class="card-form" @submit.prevent="onSubmit">
          <label class="field-label" for="password">访问密码</label>
          <div class="password-wrap" :class="{ 'has-error': !!errorMessage }">
            <input
              id="password"
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              class="password-input"
              placeholder="请输入访问密码"
              autocomplete="current-password"
              :disabled="submitting"
            />
            <button
              type="button"
              class="toggle-btn"
              :disabled="submitting"
              @click="showPassword = !showPassword"
            >
              {{ showPassword ? "隐藏" : "显示" }}
            </button>
          </div>

          <p v-if="errorMessage" class="error-text">{{ errorMessage }}</p>
          <p v-else class="hint-text">登录状态会按服务端 TTL 自动过期。</p>

          <button
            type="submit"
            :disabled="submitting || !password"
            class="submit-btn"
          >
            {{ submitting ? "验证中..." : "进入工作区" }}
          </button>
        </form>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAuthSessionStore } from "@/stores/useAuthSessionStore";

const router = useRouter();
const route = useRoute();
const authSessionStore = useAuthSessionStore();

const password = ref("");
const showPassword = ref(false);
const submitting = ref(false);
const errorMessage = ref("");

async function onSubmit() {
  errorMessage.value = "";
  submitting.value = true;

  try {
    await authSessionStore.login(password.value);
    const redirect = typeof route.query.redirect === "string" ? route.query.redirect : "/";
    await router.replace(redirect);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "登录失败";
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.login-page {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  background: radial-gradient(1200px 800px at 10% 10%, #e9f0ff 0%, #eef2ff 35%, #f4f7ff 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.login-bg {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.login-glow {
  position: absolute;
  width: 480px;
  height: 480px;
  filter: blur(60px);
  opacity: 0.35;
  border-radius: 999px;
}

.login-glow-left {
  left: -120px;
  top: -140px;
  background: #7c9cff;
}

.login-glow-right {
  right: -160px;
  bottom: -180px;
  background: #4f7bff;
}

.login-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(to right, rgba(148, 163, 184, 0.12) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(148, 163, 184, 0.12) 1px, transparent 1px);
  background-size: 40px 40px;
  mask-image: radial-gradient(circle at center, black 35%, transparent 95%);
}

.login-shell {
  position: relative;
  width: min(960px, 100%);
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
  gap: 20px;
  z-index: 1;
}

.login-brand,
.login-card {
  border-radius: 20px;
  border: 1px solid rgba(148, 163, 184, 0.25);
  background: rgba(255, 255, 255, 0.86);
  backdrop-filter: blur(10px);
  box-shadow: 0 20px 60px rgba(15, 23, 42, 0.1);
}

.login-brand {
  padding: 34px 30px;
}

.brand-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #334155;
  padding: 6px 10px;
  border-radius: 999px;
  background: #eef2ff;
  border: 1px solid #c7d2fe;
}

.brand-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: #4f46e5;
}

.brand-title {
  margin-top: 20px;
  margin-bottom: 12px;
  font-size: 34px;
  line-height: 1.2;
  color: #0f172a;
  letter-spacing: -0.02em;
}

.brand-subtitle {
  margin: 0;
  font-size: 15px;
  line-height: 1.65;
  color: #475569;
}

.brand-points {
  margin: 24px 0 0;
  padding-left: 18px;
  color: #334155;
  font-size: 14px;
  line-height: 1.8;
}

.login-card {
  padding: 30px;
}

.card-header h2 {
  margin: 0;
  font-size: 24px;
  color: #0f172a;
}

.card-header p {
  margin: 8px 0 0;
  color: #64748b;
  font-size: 14px;
}

.card-form {
  margin-top: 24px;
}

.field-label {
  display: block;
  margin-bottom: 8px;
  font-size: 13px;
  color: #475569;
  font-weight: 600;
}

.password-wrap {
  display: flex;
  align-items: center;
  border: 1px solid #cbd5e1;
  border-radius: 12px;
  background: #ffffff;
  transition: 0.2s ease;
}

.password-wrap:focus-within {
  border-color: #4f46e5;
  box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.12);
}

.password-wrap.has-error {
  border-color: #f43f5e;
}

.password-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  padding: 12px 14px;
  font-size: 14px;
  color: #0f172a;
}

.toggle-btn {
  margin-right: 8px;
  padding: 6px 10px;
  border: 1px solid #dbeafe;
  border-radius: 8px;
  font-size: 12px;
  color: #1d4ed8;
  background: #eff6ff;
  cursor: pointer;
}

.toggle-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.error-text {
  margin-top: 10px;
  margin-bottom: 0;
  color: #e11d48;
  font-size: 13px;
}

.hint-text {
  margin-top: 10px;
  margin-bottom: 0;
  color: #64748b;
  font-size: 12px;
}

.submit-btn {
  margin-top: 16px;
  width: 100%;
  border: none;
  border-radius: 12px;
  padding: 12px 16px;
  font-size: 14px;
  font-weight: 600;
  color: #ffffff;
  background: linear-gradient(135deg, #4f46e5, #2563eb);
  box-shadow: 0 10px 24px rgba(37, 99, 235, 0.3);
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.submit-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 14px 30px rgba(37, 99, 235, 0.35);
}

.submit-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  box-shadow: none;
}

@media (max-width: 900px) {
  .login-shell {
    grid-template-columns: 1fr;
  }

  .login-brand {
    display: none;
  }

  .login-card {
    padding: 24px;
  }
}
</style>
