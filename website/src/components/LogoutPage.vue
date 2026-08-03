<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { getSupabase } from '../services/supabase'

defineOptions({ name: 'LogoutPage' })

const status = ref('正在退出…')

onMounted(async () => {
  try {
    const supabase = await getSupabase()
    await supabase.auth.signOut()
  } catch (error) {
    console.warn('[LogoutPage] signOut failed', error)
  }
  // 扩展触发的后台退出：尽量关页；否则回首页（已登出）
  const fromExtension = new URLSearchParams(window.location.search).get('from_extension') === '1'
  if (fromExtension) {
    status.value = '已退出'
    window.setTimeout(() => {
      window.close()
      window.location.replace('/')
    }, 200)
    return
  }
  window.location.replace('/')
})
</script>

<template>
  <div class="logout-page">{{ status }}</div>
</template>

<style scoped>
.logout-page {
  text-align: center;
  padding: 4rem 1rem;
  color: #666;
}
</style>
