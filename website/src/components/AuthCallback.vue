<script setup lang="ts">
import { onMounted } from 'vue'
import { getSupabase } from '../services/supabase'

onMounted(async () => {
  try {
    const hash = window.location.hash
    if (!hash || !hash.includes('access_token=')) {
      window.location.href = '/login?error=no_token'
      return
    }

    const params = new URLSearchParams(hash.replace('#', ''))
    const accessToken = params.get('access_token') || ''
    const refreshToken = params.get('refresh_token') || ''

    // 用 Supabase SDK 的 setSession，自动处理存储和 token 刷新
    const supabase = await getSupabase()
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken
    })

    if (error) {
      console.error('[AuthCallback] setSession error:', error)
      window.location.href = '/login?error=session_error'
      return
    }

    window.location.href = '/account'
  } catch (e) {
    console.error('[AuthCallback]', e)
    window.location.href = '/login?error=auth_error'
  }
})
</script>

<template>
  <div style="text-align: center; padding: 4rem">正在登录...</div>
</template>
