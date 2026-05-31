<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

definePageMeta({
  title: '登录',
  description: '登录您的 otterSage 账户'
})

useSeoMeta({
  title: '登录 - otterSage',
  description: '登录您的 otterSage 账户，开始高效管理您的书签',
  ogTitle: '登录 - otterSage',
  ogDescription: '登录您的 otterSage 账户，开始高效管理您的书签'
})

const { signInWithOAuth, setOAuthSession, user, initialize } = useAuth()

// 状态
const authError = ref('')
const isGoogleLoading = ref(false)
const isMicrosoftLoading = ref(false)
const isProcessingCallback = ref(false)

const isLoading = computed(
  () => isGoogleLoading.value || isMicrosoftLoading.value || isProcessingCallback.value
)

/**
 * 登录成功后跳转
 */
const navigateToHome = () => {
  // 跳转到账户页或首页
  navigateTo('/account')
}

/**
 * 处理 OAuth 回调（从 URL hash 中提取 token）
 */
const handleOAuthCallback = async () => {
  try {
    const hash = window.location.hash

    if (!hash || !hash.includes('access_token')) {
      console.log('[Auth] 没有 OAuth 回调参数')
      return
    }

    console.log('[Auth] 检测到 OAuth 回调，开始处理...')
    isProcessingCallback.value = true
    authError.value = ''

    // 解析 URL hash 参数
    const params = new URLSearchParams(hash.substring(1))
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')

    console.log('[Auth] OAuth 回调参数', {
      hasAccessToken: !!accessToken,
      hasRefreshToken: !!refreshToken
    })

    if (!accessToken || !refreshToken) {
      throw new Error('OAuth 回调缺少必要的 token')
    }

    // 使用 Supabase 设置 session
    await setOAuthSession(accessToken, refreshToken)
    console.log('[Auth] Session 设置成功')

    // 清除 URL hash
    window.location.hash = ''

    // 短暂延迟后跳转
    setTimeout(() => {
      console.log('[Auth] 跳转到主页...')
      navigateToHome()
    }, 1000)
  } catch (error) {
    console.error('[Auth] OAuth 回调处理失败', error)
    authError.value = error instanceof Error ? error.message : 'OAuth 登录失败'
    isProcessingCallback.value = false
  }
}

/**
 * 页面加载时检查登录状态和 OAuth 回调
 */
onMounted(async () => {
  // 1. 先初始化认证状态
  await initialize()

  // 2. 检查用户是否已登录
  if (user.value) {
    console.log('[Auth] 用户已登录，跳转到账户页面')
    navigateToHome()
    return
  }

  // 3. 如果未登录，检查是否有 OAuth 回调
  handleOAuthCallback()
})

/**
 * 处理 Google 登录
 */
const handleGoogleLogin = async () => {
  try {
    isGoogleLoading.value = true
    authError.value = ''

    console.log('[Auth] 开始 Google OAuth 登录...')

    const { url } = await signInWithOAuth('google')

    // 跳转到 OAuth 授权页面
    window.location.href = url
  } catch (error) {
    console.error('[Auth] Google 登录失败', error)

    if (error instanceof Error && error.message.includes('取消')) {
      authError.value = ''
    } else {
      authError.value = error instanceof Error ? error.message : 'Google 登录失败，请重试'
    }
  } finally {
    isGoogleLoading.value = false
  }
}

/**
 * 处理 Microsoft 登录
 */
const handleMicrosoftLogin = async () => {
  try {
    isMicrosoftLoading.value = true
    authError.value = ''

    console.log('[Auth] 开始 Microsoft OAuth 登录...')

    const { url } = await signInWithOAuth('microsoft')

    // 跳转到 OAuth 授权页面
    window.location.href = url
  } catch (error) {
    console.error('[Auth] Microsoft 登录失败', error)

    if (error instanceof Error && error.message.includes('取消')) {
      authError.value = ''
    } else {
      authError.value = error instanceof Error ? error.message : 'Microsoft 登录失败，请重试'
    }
  } finally {
    isMicrosoftLoading.value = false
  }
}
</script>

<template>
  <div class="auth-page">
    <!-- Logo 和标题 -->
    <div class="auth-header">
      <img src="/logo.webp" alt="otterSage Logo" class="auth-logo" />
      <h1 class="auth-title">otterSage</h1>
      <p class="auth-subtitle">智能书签管理，一键登录</p>
    </div>

    <!-- 登录表单 -->
    <div class="auth-form">
      <h2 class="form-title">欢迎使用</h2>
      <p class="form-subtitle">使用以下方式快速登录</p>

      <!-- 错误提示 -->
      <div v-if="authError" class="auth-alert">
        <p class="auth-alert-text">{{ authError }}</p>
      </div>

      <!-- OAuth 登录按钮 -->
      <div class="oauth-buttons">
        <button
          :disabled="isLoading"
          class="oauth-btn oauth-btn--google"
          @click="handleGoogleLogin"
        >
          <svg class="oauth-icon" viewBox="0 0 24 24">
            <path
              fill="currentColor"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="currentColor"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="currentColor"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="currentColor"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          <span v-if="!isGoogleLoading">使用 Google 登录</span>
          <span v-else>登录中...</span>
        </button>

        <button
          :disabled="isLoading"
          class="oauth-btn oauth-btn--microsoft"
          @click="handleMicrosoftLogin"
        >
          <svg class="oauth-icon" viewBox="0 0 24 24">
            <path fill="#f25022" d="M1 1h10v10H1z" />
            <path fill="#00a4ef" d="M13 1h10v10H13z" />
            <path fill="#7fba00" d="M1 13h10v10H1z" />
            <path fill="#ffb900" d="M13 13h10v10H13z" />
          </svg>
          <span v-if="!isMicrosoftLoading">使用 Microsoft 登录</span>
          <span v-else>登录中...</span>
        </button>
      </div>

      <!-- 隐私提示 -->
      <p class="auth-privacy-notice">
        登录即表示您同意我们的
        <NuxtLink to="/terms" target="_blank">服务条款</NuxtLink>
        和
        <NuxtLink to="/privacy" target="_blank">隐私政策</NuxtLink>
      </p>
    </div>
  </div>
</template>

<style scoped>
@keyframes float {
  0%,
  100% {
    transform: translateY(0) rotate(0deg);
  }

  50% {
    transform: translateY(-20px) rotate(5deg);
  }
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }

  50% {
    opacity: 0.9;
    transform: scale(1.05);
  }
}

@keyframes shimmer {
  0% {
    background-position: -1000px 0;
  }

  100% {
    background-position: 1000px 0;
  }
}

@keyframes fade-in-up {
  from {
    opacity: 0;
    transform: translateY(30px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ===== 响应式 ===== */
@media (width <= 480px) {
  .auth-page {
    padding: var(--spacing-4);
  }

  .auth-header {
    margin-bottom: var(--spacing-6);
  }

  .auth-logo {
    width: 64px;
    height: 64px;
  }

  .auth-title {
    font-size: 1.5rem;
  }

  .auth-subtitle {
    font-size: 0.875rem;
  }

  .auth-form {
    max-width: 100%;
    padding: var(--spacing-8) var(--spacing-6);
  }

  .form-title {
    font-size: 1.25rem;
  }

  .form-subtitle {
    font-size: 0.875rem;
  }

  .oauth-btn {
    padding: var(--spacing-4);
    font-size: 0.9375rem;
  }

  .oauth-icon {
    width: 20px;
    height: 20px;
  }
}

/* ===== 深色模式优化 ===== */
@media (prefers-color-scheme: dark) {
  .auth-page {
    /* 深色模式下保持相同的深色背景 */
    background: linear-gradient(135deg, #0a1612 0%, #0e1a17 50%, #0a1410 100%);
  }

  .auth-form {
    border-color: rgb(131 213 197 / 20%);
    background: rgb(20 30 26 / 90%);
    box-shadow:
      0 24px 64px rgb(0 0 0 / 50%),
      0 12px 32px rgb(0 0 0 / 40%),
      inset 0 1px 0 rgb(255 255 255 / 8%);
  }
}

/* ===== 页面容器 ===== */
.auth-page {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  padding: var(--spacing-6);

  /* 🎨 深色背景，提高对比度 */
  background: linear-gradient(135deg, #0a1612 0%, #0e1a17 50%, #0a1410 100%);
  overflow: hidden;
}

/* 🎨 背景装饰元素 - 薄荷绿光晕 */
.auth-page::before,
.auth-page::after {
  position: absolute;
  border-radius: 50%;
  opacity: 0.15;
  pointer-events: none;
  content: '';
}

.auth-page::before {
  top: -10%;
  right: -5%;
  width: 500px;
  height: 500px;
  background: radial-gradient(circle, var(--md-sys-color-primary) 0%, transparent 70%);
  animation: float 20s ease-in-out infinite;
}

.auth-page::after {
  bottom: -10%;
  left: -5%;
  width: 400px;
  height: 400px;
  background: radial-gradient(circle, var(--md-sys-color-secondary) 0%, transparent 70%);
  animation: float 25s ease-in-out infinite reverse;
}

/* ===== 头部区域 ===== */
.auth-header {
  position: relative;
  z-index: 1;
  margin-bottom: var(--spacing-10);
  text-align: center;
  animation: fade-in-up 0.6s ease-out;
}

.auth-logo {
  width: 96px;
  height: 96px;
  margin: 0 auto var(--spacing-5);
  filter: drop-shadow(0 8px 24px color-mix(in srgb, var(--md-sys-color-primary) 40%, transparent));
  animation: pulse 3s ease-in-out infinite;
  object-fit: contain;
}

.auth-title {
  margin: 0 0 var(--spacing-3) 0;
  font-size: 2.25rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: #fff;
  text-shadow: 0 2px 12px rgb(0 0 0 / 30%);
}

.auth-subtitle {
  margin: 0;
  font-size: 1.0625rem;
  font-weight: 400;
  color: rgb(255 255 255 / 70%);
}

/* ===== 登录表单卡片 ===== */
.auth-form {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 440px;
  padding: var(--spacing-10) var(--spacing-8);
  border: 1px solid rgb(131 213 197 / 15%);

  /* 🎨 现代化卡片样式 - 更高对比度 */
  border-radius: var(--radius-lg);
  background: rgb(20 30 26 / 85%);
  animation: fade-in-up 0.6s ease-out 0.2s both;
  backdrop-filter: blur(24px);
  box-shadow:
    0 24px 64px rgb(0 0 0 / 40%),
    0 12px 32px rgb(0 0 0 / 30%),
    inset 0 1px 0 rgb(255 255 255 / 5%);
}

.form-title {
  margin: 0 0 24px;
  font-size: 1.5rem;
  font-weight: 600;
  text-align: center;
  color: #fff;
}

.form-subtitle {
  margin: 0 0 40px;
  font-size: 0.9375rem;
  text-align: center;
  color: rgb(255 255 255 / 60%);
}

/* ===== 错误提示 ===== */
.auth-alert {
  margin-bottom: var(--spacing-4);
  padding: var(--spacing-3) var(--spacing-4);
  border: 1px solid color-mix(in srgb, var(--md-sys-color-error) 30%, transparent);
  border-radius: var(--radius-md);
  background: linear-gradient(
    135deg,
    color-mix(in srgb, var(--md-sys-color-error) 12%, transparent) 0%,
    color-mix(in srgb, var(--md-sys-color-error) 8%, transparent) 100%
  );
  animation: fade-in-up 0.3s ease-out;
}

.auth-alert-text {
  margin: 0;
  font-size: 0.875rem;
  font-weight: 500;
  text-align: center;
  color: var(--md-sys-color-error);
}

/* ===== OAuth 登录按钮 ===== */
.oauth-buttons {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-bottom: 40px;
}

.oauth-btn {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 18px 20px;
  border: 1.5px solid rgb(131 213 197 / 20%);
  border-radius: var(--radius-md);
  font-size: 0.9375rem;
  font-weight: 500;
  color: #fff;
  background: rgb(30 45 40 / 60%);
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
}

/* 按钮悬停效果 */
.oauth-btn::before {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 0;
  height: 0;
  border-radius: 50%;
  background: rgb(131 213 197 / 15%);
  transform: translate(-50%, -50%);
  transition:
    width 0.6s ease,
    height 0.6s ease,
    top 0.6s ease,
    left 0.6s ease;
  content: '';
}

.oauth-btn:hover::before {
  width: 300px;
  height: 300px;
}

.oauth-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.oauth-btn:disabled::before {
  display: none;
}

/* Google 按钮 */
.oauth-btn--google {
  border-color: rgb(131 213 197 / 30%);
}

.oauth-btn--google:hover:not(:disabled) {
  border-color: var(--md-sys-color-primary);
  background: rgb(30 45 40 / 80%);
  box-shadow:
    0 8px 24px rgb(131 213 197 / 20%),
    0 4px 12px rgb(131 213 197 / 10%);
  transform: translateY(-2px);
}

.oauth-btn--google:active:not(:disabled) {
  transform: translateY(0);
}

/* Microsoft 按钮 */
.oauth-btn--microsoft {
  border-color: rgb(177 204 197 / 30%);
}

.oauth-btn--microsoft:hover:not(:disabled) {
  border-color: var(--md-sys-color-secondary);
  background: rgb(30 45 40 / 80%);
  box-shadow:
    0 8px 24px rgb(177 204 197 / 20%),
    0 4px 12px rgb(177 204 197 / 10%);
  transform: translateY(-2px);
}

.oauth-btn--microsoft:active:not(:disabled) {
  transform: translateY(0);
}

/* 图标 */
.oauth-icon {
  position: relative;
  z-index: 1;
  flex-shrink: 0;
  width: 20px;
  height: 20px;
}

.oauth-btn span {
  position: relative;
  z-index: 1;
}

/* ===== 隐私提示 ===== */
.auth-privacy-notice {
  margin: 0;
  padding-top: 28px;
  border-top: 1px solid rgb(131 213 197 / 15%);
  font-size: 0.8125rem;
  line-height: 1.6;
  text-align: center;
  color: rgb(255 255 255 / 50%);
}

.auth-privacy-notice a {
  font-weight: 500;
  text-decoration: none;
  color: var(--md-sys-color-primary);
  transition: all 0.2s ease;
}

.auth-privacy-notice a:hover {
  text-decoration: underline;
  color: rgb(131 213 197 / 100%);
}

/* ===== 动画 ===== */
</style>
