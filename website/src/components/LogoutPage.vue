<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { getSupabase } from '../services/supabase'

defineOptions({ name: 'LogoutPage' })

const status = ref('Signing out…')

onMounted(async () => {
  try {
    const supabase = await getSupabase()
    await supabase.auth.signOut()
  } catch (error) {
    console.warn('[LogoutPage] signOut failed', error)
  }
  // 扩展触发的后台退出：尽量关页；否则进登录页
  const fromExtension = new URLSearchParams(window.location.search).get('from_extension') === '1'
  if (fromExtension) {
    status.value = 'Signed out'
    window.setTimeout(() => {
      window.close()
      window.location.replace('/login')
    }, 200)
    return
  }
  window.location.replace('/login')
})
</script>

<template>
  <p class="ui-status">{{ status }}</p>
</template>
