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
  registerAndHandoffDeviceToExtension,
  type RegisterAndHandoffResult
} from '../services/extension-auth-handoff'
import { t } from '../i18n/t'

const status = ref(t('login.status.signingIn'))

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

/** 用官网 session 注册 device token 并 handoff（失败不共享官网 refresh） */
async function tryRegisterHandoff(session: Session): Promise<RegisterAndHandoffResult> {
  const profile = extractProfileFromUserMetadata(
    session.user.user_metadata as Record<string, unknown> | undefined
  )
  return registerAndHandoffDeviceToExtension({
    websiteAccessToken: session.access_token,
    userId: session.user.id,
    ...(session.user.email ? { email: session.user.email } : {}),
    ...profile
  })
}

/**
 * 登录成功收尾优先级：
 * 1) 本次从扩展打开（sessionStorage `connect_extension`）→ device-register + handoff + /account
 * 2) 有 next（如续付）→ 只回跳官网意图；**不**因 last_extension_id 静默 register
 * 3) 默认 /account；纯官网登录**不**动扩展设备（须显式 Connect / connect_extension）
 */
async function finishWithSession(session: Session): Promise<void> {
  const pendingConnect = getPendingExtensionId()
  const authReturn = peekAuthReturn()

  if (pendingConnect) {
    status.value = t('login.status.connectingExtension')
    const handoff = await tryRegisterHandoff(session)
    if (handoff.status === 'ok') {
      window.location.href = '/account?extension_connected=1'
      return
    }
    if (handoff.status === 'account_mismatch') {
      status.value = t('login.status.connectAccountMismatch')
      window.setTimeout(() => {
        window.location.href = '/account?extension_connected=0&connect_error=account_mismatch'
      }, 3200)
      return
    }
    status.value = t('login.status.connectFailed')
    window.setTimeout(() => {
      window.location.href = '/account?extension_connected=0'
    }, 2800)
    return
  }

  // 无本次 connect：只完成官网会话。禁止用 last_extension_id 顺带 register
  if (authReturn.next) {
    const href = buildPostAuthHref('/account')
    console.warn('[AuthCallback] 登录成功，回跳续意图（不 mint 扩展）', { href })
    window.location.href = href
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
  <p class="ui-status">{{ status }}</p>
</template>
