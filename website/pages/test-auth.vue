<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

const { user, isAuthenticated, initialize } = useAuth()
const config = useRuntimeConfig()

const supabaseUrl = computed(() => config.public.supabaseUrl)
const isConfigured = computed(() => isSupabaseConfigured())
const currentOrigin = computed(() => typeof window !== 'undefined' ? window.location.origin : '')
const callbackUrl = computed(() => `${currentOrigin.value}/auth/callback`)
const testResult = ref('')

onMounted(() => {
  initialize()
})

const simulateOAuthCallback = () => {
  testResult.value = '模拟回调功能开发中...'
  
  // 模拟跳转到回调页面
  const mockTokens = {
    access_token: 'mock_access_token_' + Date.now(),
    refresh_token: 'mock_refresh_token_' + Date.now()
  }
  
  const simulatedCallbackUrl = `/auth/callback#access_token=${mockTokens.access_token}&refresh_token=${mockTokens.refresh_token}`
  
  testResult.value = `✅ 模拟回调 URL 生成成功！\n即将跳转到: ${simulatedCallbackUrl}`
  
  setTimeout(() => {
    navigateTo(simulatedCallbackUrl)
  }, 2000)
}
</script>

<template>
  <div class="test-auth-page">
    <div class="test-container">
      <h1>认证流程测试</h1>
      
      <div class="test-section">
        <h2>1. Supabase 配置检查</h2>
        <div class="test-result">
          <p><strong>Supabase URL:</strong> {{ supabaseUrl }}</p>
          <p><strong>配置状态:</strong> {{ isConfigured ? '✅ 已配置' : '❌ 未配置' }}</p>
          <p><strong>当前域名:</strong> {{ currentOrigin }}</p>
          <p><strong>回调 URL:</strong> {{ callbackUrl }}</p>
        </div>
        <div class="test-warning">
          <p><strong>⚠️ 重要提示：</strong></p>
          <p>请确保在 Supabase Dashboard 的 Authentication > URL Configuration 中添加了以下回调 URL：</p>
          <code>{{ callbackUrl }}</code>
          <p style="margin-top: 12px;">
            <strong>配置链接：</strong>
            <a 
              href="https://supabase.com/dashboard/project/cqw547847/auth/url-configuration" 
              target="_blank"
              class="warning-link"
            >
              打开 Supabase Dashboard 配置页面
            </a>
          </p>
          <p style="margin-top: 8px; font-size: 12px; opacity: 0.8;">
            注意：添加官网回调 URL 时，请保留现有的 Chrome Extension 回调 URL，不要删除！
          </p>
        </div>
      </div>

      <div class="test-section">
        <h2>2. 认证状态</h2>
        <div class="test-result">
          <p><strong>登录状态:</strong> {{ isAuthenticated ? '✅ 已登录' : '❌ 未登录' }}</p>
          <p v-if="user"><strong>用户 ID:</strong> {{ user.id }}</p>
          <p v-if="user"><strong>邮箱:</strong> {{ user.email }}</p>
        </div>
      </div>

      <div class="test-section">
        <h2>3. 模拟 OAuth 回调</h2>
        <p class="test-description">
          点击下面的按钮模拟 OAuth 登录成功后的回调流程
        </p>
        <button class="test-button" @click="simulateOAuthCallback">
          模拟 OAuth 回调
        </button>
        <div v-if="testResult" class="test-result">
          <p>{{ testResult }}</p>
        </div>
      </div>

      <div class="test-section">
        <h2>4. 跳转测试</h2>
        <div class="test-links">
          <NuxtLink to="/login" class="test-link">→ 登录页面</NuxtLink>
          <NuxtLink to="/account" class="test-link">→ 账户页面</NuxtLink>
          <NuxtLink to="/" class="test-link">→ 首页</NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.test-auth-page {
  min-height: 100vh;
  padding: var(--spacing-6);
  background: var(--md-sys-color-background);
}

.test-container {
  max-width: 800px;
  margin: 0 auto;
}

h1 {
  margin-bottom: var(--spacing-6);
  font-size: var(--text-2xl);
  font-weight: var(--font-bold);
  color: var(--md-sys-color-on-background);
}

.test-section {
  margin-bottom: var(--spacing-6);
  padding: var(--spacing-5);
  border: 1px solid color-mix(in srgb, white 10%, transparent);
  border-radius: var(--radius-lg);
  background: var(--md-sys-color-surface);
}

h2 {
  margin-bottom: var(--spacing-3);
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--md-sys-color-on-background);
}

.test-description {
  margin-bottom: var(--spacing-3);
  font-size: var(--text-sm);
  color: var(--md-sys-color-on-surface-variant);
}

.test-result {
  padding: var(--spacing-3);
  border-radius: var(--radius-md);
  background: var(--md-sys-color-surface-variant);
  font-family: monospace;
  font-size: var(--text-sm);
}

.test-result p {
  margin: var(--spacing-2) 0;
  color: var(--md-sys-color-on-surface-variant);
}

.test-warning {
  margin-top: var(--spacing-3);
  padding: var(--spacing-3);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--acuity-semantic-warning) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--acuity-semantic-warning) 30%, transparent);
}

.test-warning p {
  margin: var(--spacing-1) 0;
  font-size: var(--text-sm);
  color: var(--md-sys-color-on-background);
}

.test-warning code {
  display: block;
  margin-top: var(--spacing-2);
  padding: var(--spacing-2);
  background: color-mix(in srgb, black 20%, transparent);
  border-radius: var(--radius-sm);
  font-family: monospace;
  font-size: var(--text-xs);
  color: var(--acuity-semantic-warning);
}

.warning-link {
  color: var(--acuity-semantic-warning);
  text-decoration: underline;
}

.test-button {
  padding: var(--spacing-3) var(--spacing-6);
  background-color: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
  border: none;
  border-radius: var(--radius-md);
  font-weight: var(--font-medium);
  cursor: pointer;
  transition: all 0.2s ease;
}

.test-button:hover {
  background-color: color-mix(in srgb, var(--md-sys-color-primary), black 10%);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px color-mix(in srgb, black 15%, transparent);
}

.test-links {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.test-link {
  padding: var(--spacing-2) var(--spacing-3);
  border: 1px solid color-mix(in srgb, white 10%, transparent);
  border-radius: var(--radius-md);
  color: var(--md-sys-color-primary);
  text-decoration: none;
  transition: all 0.2s ease;
}

.test-link:hover {
  background: var(--md-sys-color-surface-variant);
  border-color: var(--md-sys-color-primary);
}
</style>
