<script setup lang="ts">
import { onMounted } from 'vue'

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
    const expiresAt = params.get('expires_at')

    // 解码 JWT 获取 payload
    let payload: any = {}
    try {
      payload = JSON.parse(atob(accessToken.split('.')[1]))
    } catch {}

    // 构造完整的 session 对象
    const session = {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 3600,
      expires_at: expiresAt ? parseInt(expiresAt) : Math.floor(Date.now() / 1000) + 3600,
      token_type: 'bearer',
      user: {
        id: payload.sub || '',
        aud: 'authenticated',
        role: 'authenticated',
        email: payload.email || '',
        app_metadata: { provider: 'google' },
        user_metadata: {
          name: payload.name || payload.email || '',
          avatar_url: payload.picture || payload.avatar_url || '',
          email: payload.email || ''
        },
        last_sign_in_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        identities: [{
          id: payload.sub || '',
          provider: 'google',
          created_at: new Date().toISOString(),
          last_sign_in_at: new Date().toISOString()
        }]
      }
    }

    // 直接写 localStorage
    const projectRef = 'ugxgxytykxblctsyulsg'
    const storageKey = `sb-${projectRef}-auth-token`
    localStorage.setItem(storageKey, JSON.stringify(session))

    window.location.href = '/account'
  } catch (e) {
    console.error('[AuthCallback]', e)
    window.location.href = '/login?error=auth_error'
  }
})
</script>

<template>
  <div style="text-align:center;padding:4rem;">正在登录...</div>
</template>
