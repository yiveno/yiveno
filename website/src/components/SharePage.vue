<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getShare } from '../services/share'

const share = ref<any>(null)
const error = ref('')

onMounted(async () => {
  const params = new URLSearchParams(window.location.search)
  const shortCode = params.get('code') || window.location.pathname.replace(/^\/share\//, '')
  if (!shortCode) {
    error.value = '无效的链接'
    return
  }
  const data = await getShare(shortCode)
  if (data) {
    share.value = data
    window.location.href = '/account'
  } else {
    error.value = '分享链接不存在或已失效'
  }
})
</script>

<template>
  <div class="share-page">
    <div v-if="share" class="redirecting">
      <p>正在跳转...</p>
    </div>
    <div v-else-if="error" class="error">
      <p>{{ error }}</p>
    </div>
    <div v-else class="loading">
      <p>加载中...</p>
    </div>
  </div>
</template>

<style scoped>
.share-page { max-width:600px; margin:4rem auto; text-align:center; }
.error p { color:#e53e3e; }
.loading p { color:#999; }
</style>
