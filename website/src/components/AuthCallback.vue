<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { getSupabase } from '../services/supabase'
import {
  captureExtensionConnectParamsFromUrl,
  extractProfileFromUserMetadata,
  getPendingExtensionId,
  handoffSessionToExtension
} from '../services/extension-auth-handoff'

const status = ref('正在登录…')

onMounted(async () => {
  try {
    // OAuth 前在 /login 写入的 sessionStorage；此处再尝试从 query 捕获（防御）
    captureExtensionConnectParamsFromUrl()

    const hash = window.location.hash
    if (!hash || !hash.includes('access_token=')) {
      window.location.href = '/login?error=no_token'
      return
    }

    const params = new URLSearchParams(hash.replace('#', ''))
    const accessToken = params.get('access_token') || ''
    const refreshToken = params.get('refresh_token') || ''

    const supabase = await getSupabase()
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken
    })

    if (error || !data.session?.user?.id) {
      console.error('[AuthCallback] setSession error:', error)
      window.location.href = '/login?error=session_error'
      return
    }

    if (getPendingExtensionId()) {
      status.value = '正在连接扩展…'
      const session = data.session
      const profile = extractProfileFromUserMetadata(
        session.user.user_metadata as Record<string, unknown> | undefined
      )
      const ok = await handoffSessionToExtension({
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
        userId: session.user.id,
        ...(session.user.email ? { email: session.user.email } : {}),
        ...(session.expires_at != null ? { expiresAt: session.expires_at } : {}),
        ...profile
      })
      if (ok) {
        window.location.href = '/account?extension_connected=1'
        return
      }
      status.value = '登录成功，但扩展未连接。请确认扩展已安装后从扩展设置重新登录。'
      window.setTimeout(() => {
        window.location.href = '/account?extension_connected=0'
      }, 2000)
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
  <div style="text-align: center; padding: 4rem">{{ status }}</div>
</template>
