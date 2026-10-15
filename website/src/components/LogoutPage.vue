<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { getSupabase } from '../services/supabase'
import { ensureUiBridgeConnected, publishWebsiteAuthChanged } from '../services/ui-bridge'

defineOptions({ name: 'LogoutPage' })

const status = ref('Signing out…')

onMounted(async () => {
  try {
    await ensureUiBridgeConnected()
    const supabase = await getSupabase()
    // 仅清本页会话；其它设备 / 扩展独立 session 不因本机 /logout 被 global 撤销
    await supabase.auth.signOut({ scope: 'local' })
  } catch (error) {
    console.warn('[LogoutPage] signOut failed', error)
  }
  // UI 桥：立刻告诉扩展「官网已退出」（Connect 可消失）
  publishWebsiteAuthChanged({ signedIn: false })
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
