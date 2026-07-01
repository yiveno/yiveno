<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { getSession, signInWithOAuth } from '../services/auth'

const loading = ref(false)
const error = ref('')

/** 已登录用户访问 /login 时跳转账户页 */
onMounted(async () => {
  try {
    const session = await getSession()
    if (session) {
      window.location.replace('/account')
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : '检查登录状态失败'
    error.value = message
  }
})

async function login(provider: 'google' | 'microsoft') {
  loading.value = true
  error.value = ''
  try {
    await signInWithOAuth(provider)
  } catch (e: unknown) {
    error.value = (e instanceof Error ? e.message : String(e)) || '登录失败'
    loading.value = false
  }
}
</script>

<template>
  <div class="login-form">
    <h2>登录 Yiveno</h2>
    <p v-if="error" class="error">{{ error }}</p>
    <button :disabled="loading" class="btn" @click="login('google')">
      {{ loading ? '跳转中...' : '使用 Google 登录' }}
    </button>
    <button :disabled="loading" class="btn" @click="login('microsoft')">
      {{ loading ? '跳转中...' : '使用 Microsoft 登录' }}
    </button>
  </div>
</template>

<style scoped>
.login-form {
  max-width: 360px;
  margin: 4rem auto;
  text-align: center;
}

.btn {
  display: block;
  width: 100%;
  padding: 0.75rem;
  margin: 0.5rem 0;
  border: 1px solid #ddd;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  font-size: 1rem;
}

.btn:hover {
  background: #f5f5f5;
}

.btn:disabled {
  opacity: 0.5;
}

.error {
  color: #e53e3e;
  font-size: 0.875rem;
}
</style>
