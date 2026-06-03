<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getShareDetail } from '../services/share'

const error = ref('')

onMounted(async () => {
  const params = new URLSearchParams(window.location.search)
  let shortCode = params.get('code') || ''
  if (!shortCode) {
    shortCode = window.location.pathname.replace(/^\/s\//, '')
  }
  if (!shortCode) {
    error.value = '无效的链接'
    return
  }
  const data = await getShareDetail(shortCode)
  if (data) {
    window.location.href = `/share?code=${shortCode}`
  } else {
    error.value = '链接已失效'
  }
})
</script>

<template>
  <div style="text-align:center;padding:4rem;">
    <p v-if="error" style="color:#e53e3e;">{{ error }}</p>
    <p v-else>正在跳转...</p>
  </div>
</template>
