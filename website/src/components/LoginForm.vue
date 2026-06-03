<script setup lang="ts">
import { ref } from 'vue'
import { signInWithOAuth } from '../services/auth'

const loading = ref(false)
const error = ref('')

async function login(provider: 'google' | 'microsoft') {
  loading.value = true
  error.value = ''
  try {
    await signInWithOAuth(provider)
  } catch (e: any) {
    error.value = e.message || '登录失败'
    loading.value = false
  }
}
</script>

<template>
  <div class="login-form">
    <h2>登录 otterSage</h2>
    <p v-if="error" class="error">{{ error }}</p>
    <button :disabled="loading" @click="login('google')" class="btn">
      {{ loading ? '跳转中...' : '使用 Google 登录' }}
    </button>
    <button :disabled="loading" @click="login('microsoft')" class="btn">
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
