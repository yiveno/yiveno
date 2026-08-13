<script setup lang="ts">
import type { Session } from '@supabase/supabase-js'
import { onMounted, ref } from 'vue'
import {
  buildPostAuthHref,
  captureAuthReturnFromUrl,
  peekAuthReturn
} from '../services/auth-return'
import { getSupabase } from '../services/supabase'
import {
  captureExtensionConnectParamsFromUrl,
  extractProfileFromUserMetadata,
  getPendingExtensionId,
  handoffSessionToExtension,
  resolveExtensionHandoffTargetId
} from '../services/extension-auth-handoff'

const status = ref('Signing in…')

/** 跳回登录页，并带上可诊断的短错误码（避免超长 URL） */
function redirectLoginError(code: string, detail?: string | null): void {
  const pending = peekAuthReturn()
  const params = new URLSearchParams()
  params.set('error', code)
  if (detail) {
    // 截断，防止 error_description 过长
    params.set('detail', detail.slice(0, 180))
  }
  if (pending.next) params.set('next', pending.next)
  if (pending.intent) params.set('intent', pending.intent)
  window.location.href = `/login?${params.toString()}`
}

function sessionHandoffPayload(session: Session) {
  const profile = extractProfileFromUserMetadata(
    session.user.user_metadata as Record<string, unknown> | undefined
  )
  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    userId: session.user.id,
    ...(session.user.email ? { email: session.user.email } : {}),
    ...(session.expires_at != null ? { expiresAt: session.expires_at } : {}),
    ...profile
  }
}

/**
 * 登录成功收尾优先级：
 * 1) 本次从扩展打开（connect_extension）→ handoff + /account
 * 2) 有 next（如续付）→ 回跳；扩展仅静默同步，不抢导航
 * 3) 默认 /account；有上次扩展 id 则顺带同步
 */
async function finishWithSession(session: Session): Promise<void> {
  const payload = sessionHandoffPayload(session)
  const pendingConnect = getPendingExtensionId()
  const authReturn = peekAuthReturn()

  if (pendingConnect) {
    status.value = 'Connecting to the extension…'
    const ok = await handoffSessionToExtension(payload)
    if (ok) {
      window.location.href = '/account?extension_connected=1'
      return
    }
    status.value =
      'Signed in, but the extension did not connect. Open Yiveno extension → Settings → Sign in again.'
    window.setTimeout(() => {
      window.location.href = '/account?extension_connected=0'
    }, 2000)
    return
  }

  if (authReturn.next) {
    if (resolveExtensionHandoffTargetId()) {
      // 不阻塞回跳：上次装过扩展则尽力同步
      void handoffSessionToExtension(payload)
    }
    const href = buildPostAuthHref('/account')
    console.warn('[AuthCallback] 登录成功，回跳续意图', { href })
    window.location.href = href
    return
  }

  if (resolveExtensionHandoffTargetId()) {
    status.value = 'Connecting to the extension…'
    const ok = await handoffSessionToExtension(payload)
    window.location.href = ok ? '/account?extension_connected=1' : '/account'
    return
  }

  window.location.href = '/account'
}

onMounted(async () => {
  try {
    // OAuth 前在 /login 写入的 sessionStorage；此处再尝试从 query 捕获（防御）
    captureExtensionConnectParamsFromUrl()
    captureAuthReturnFromUrl()

    const url = new URL(window.location.href)

    // GoTrue / 上游 OAuth 错误（出现在 query，须在建 client 前读，避免被吞）
    const oauthError = url.searchParams.get('error')
    if (oauthError) {
      const description = url.searchParams.get('error_description')
      console.error('[AuthCallback] OAuth 回调错误', {
        error: oauthError,
        description
      })
      redirectLoginError('oauth_error', description || oauthError)
      return
    }

    const supabase = await getSupabase()

    // 主路径（implicit）：#access_token=
    const hash = window.location.hash
    if (hash.includes('access_token=')) {
      console.warn('[AuthCallback] 使用 hash access_token 设置 session')
      const params = new URLSearchParams(hash.replace(/^#/, ''))
      const accessToken = params.get('access_token') || ''
      const refreshToken = params.get('refresh_token') || ''
      const { data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken
      })
      if (error || !data.session?.user?.id) {
        console.error('[AuthCallback] setSession 失败:', error)
        redirectLoginError('session_error', error?.message)
        return
      }
      await finishWithSession(data.session)
      return
    }

    // 兼容 PKCE：?code=
    const code = url.searchParams.get('code')
    if (code) {
      console.warn('[AuthCallback] 使用 PKCE code 换取 session')
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)
      if (error || !data.session?.user?.id) {
        console.error('[AuthCallback] exchangeCodeForSession 失败:', error)
        redirectLoginError('session_error', error?.message)
        return
      }
      await finishWithSession(data.session)
      return
    }

    const { data: existing } = await supabase.auth.getSession()
    if (existing.session?.user?.id) {
      console.warn('[AuthCallback] 复用已有 session')
      await finishWithSession(existing.session)
      return
    }

    console.error('[AuthCallback] 回调 URL 无 code / access_token，且无已有 session', {
      search: url.search,
      hash: url.hash ? '[present]' : ''
    })
    redirectLoginError('no_token')
  } catch (e) {
    console.error('[AuthCallback]', e)
    const message = e instanceof Error ? e.message : String(e)
    redirectLoginError('auth_error', message)
  }
})
</script>

<template>
  <div style="text-align: center; padding: 4rem">{{ status }}</div>
</template>
