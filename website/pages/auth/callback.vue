<script setup lang="ts">
import { ref, onMounted } from 'vue'

definePageMeta({
  title: 'OAuth 回调',
  description: '正在处理登录...'
})

const { setOAuthSession } = useAuth()
const error = ref('')

onMounted(async () => {
  try {
    // 获取 URL hash 中的 tokens
    const hashParams = new URLSearchParams(window.location.hash.substring(1))
    const accessToken = hashParams.get('access_token')
    const refreshToken = hashParams.get('refresh_token')

    if (!accessToken || !refreshToken) {
      throw new Error('未获取到授权信息')
    }

    console.log('[OAuth Callback] 收到 tokens')

    // 设置 Supabase session
    await setOAuthSession(accessToken, refreshToken)

    // 登录成功，跳转到账户页面
    await navigateTo('/account')
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'OAuth 登录失败'
  }
})
</script>

<template>
  <div class="callback-page">
    <div class="callback-content">
      <div v-if="error" class="callback-error">
        <div class="error-icon">✖</div>
        <h1 class="error-title">登录失败</h1>
        <p class="error-message">{{ error }}</p>
        <NuxtLink to="/login" class="error-button"> 返回登录 </NuxtLink>
      </div>
      <div v-else class="callback-loading">
        <div class="loading-spinner"></div>
        <h1 class="loading-title">登录中...</h1>
        <p class="loading-message">正在处理您的登录请求</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.callback-page {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  padding: var(--spacing-4);
  background: linear-gradient(
    135deg,
    var(--md-sys-color-primary-container) 0%,
    var(--md-sys-color-secondary-container) 100%
  );
}

.callback-content {
  text-align: center;
}

.callback-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-4);
}

.error-icon {
  font-size: 4rem;
  color: var(--md-sys-color-error);
}

.error-title {
  margin: 0;
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
  color: var(--md-sys-color-on-background);
}

.error-message {
  margin: 0;
  font-size: var(--text-base);
  color: var(--md-sys-color-on-surface-variant);
}

.error-button {
  display: inline-block;
  margin-top: var(--spacing-4);
  padding: var(--spacing-3) var(--spacing-6);
  background-color: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
  border-radius: var(--radius-md);
  text-decoration: none;
  font-weight: var(--font-medium);
  transition: all 0.2s ease;
}

.error-button:hover {
  background-color: color-mix(in srgb, var(--md-sys-color-primary), black 10%);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px color-mix(in srgb, black 15%, transparent);
}

.callback-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-4);
}

.loading-spinner {
  width: 48px;
  height: 48px;
  border: 4px solid color-mix(in srgb, white 30%, transparent);
  border-top-color: var(--md-sys-color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loading-title {
  margin: 0;
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
  color: var(--md-sys-color-on-background);
}

.loading-message {
  margin: 0;
  font-size: var(--text-base);
  color: var(--md-sys-color-on-surface-variant);
}
</style>
