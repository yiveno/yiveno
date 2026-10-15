<script setup lang="ts">
/**
 * 扩展已登录、官网未登录（或账号不一致）时的反向接通页。
 * 向扩展要官网会话 → setSession → 跳 next（默认 /account）。
 */
import { onMounted, ref } from 'vue'
import { getSupabase } from '../services/supabase'
import { clearNavIsProCache } from '../services/nav-pro-badge-cache'
import { ensureUiBridgeConnected, publishWebsiteAuthChanged } from '../services/ui-bridge'
import { rememberConnectedExtensionId } from '../services/extension-auth-handoff'

defineOptions({ name: 'FromExtensionAuth' })

const status = ref('Connecting from the extension…')

type ChromeRuntimeMessenger = {
  sendMessage: (
    extensionId: string,
    message: unknown,
    responseCallback?: (response: unknown) => void
  ) => void
  lastError?: { message?: string }
}

function getChromeRuntime(): ChromeRuntimeMessenger | null {
  const chromeApi = (globalThis as { chrome?: { runtime?: ChromeRuntimeMessenger } }).chrome
  return chromeApi?.runtime ?? null
}

function sendToExtension(extensionId: string, message: unknown): Promise<unknown> {
  const runtime = getChromeRuntime()
  if (!runtime?.sendMessage) {
    return Promise.resolve(null)
  }
  return new Promise(resolve => {
    try {
      runtime.sendMessage(extensionId, message, response => {
        void runtime.lastError
        resolve(response ?? null)
      })
    } catch {
      resolve(null)
    }
  })
}

function safeNextPath(raw: string | null): string {
  const trimmed = raw?.trim() || '/account'
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('://')) {
    return '/account'
  }
  return trimmed
}

onMounted(async () => {
  const params = new URLSearchParams(window.location.search)
  const extensionId = params.get('extension_id')?.trim() ?? ''
  const nextPath = safeNextPath(params.get('next'))

  if (!extensionId) {
    status.value = 'Missing extension. Open Account from the Yiveno side panel.'
    return
  }

  rememberConnectedExtensionId(extensionId)

  // 已同账号：跳过 mint
  try {
    const supabase = await getSupabase()
    const { data: existing } = await supabase.auth.getSession()
    const websiteUserId = existing.session?.user?.id?.trim()
    if (websiteUserId) {
      const probe = await sendToExtension(extensionId, {
        type: 'YIVENO_EXTENSION_AUTH_STATUS_PROBE',
        payload: { expectedUserId: websiteUserId }
      })
      if (
        typeof probe === 'object' &&
        probe !== null &&
        (probe as { ok?: unknown }).ok === true &&
        (probe as { signedIn?: unknown }).signedIn === true &&
        typeof (probe as { userId?: unknown }).userId === 'string' &&
        (probe as { userId: string }).userId.trim() === websiteUserId
      ) {
        status.value = 'Already signed in'
        window.location.replace(nextPath)
        return
      }
    }
  } catch (error) {
    console.warn('[FromExtensionAuth] existing session check failed', error)
  }

  status.value = 'Signing you in…'
  const response = await sendToExtension(extensionId, {
    type: 'YIVENO_WEBSITE_SESSION_REQUEST',
    payload: { nextPath }
  })

  if (
    typeof response !== 'object' ||
    response === null ||
    (response as { ok?: unknown }).ok !== true ||
    typeof (response as { accessToken?: unknown }).accessToken !== 'string' ||
    typeof (response as { refreshToken?: unknown }).refreshToken !== 'string' ||
    typeof (response as { userId?: unknown }).userId !== 'string'
  ) {
    console.warn('[FromExtensionAuth] website session request failed', response)
    status.value = 'Could not sign in from the extension. Try Sign in on this page.'
    window.setTimeout(() => {
      window.location.replace(`/login?next=${encodeURIComponent(nextPath)}`)
    }, 1600)
    return
  }

  const accessToken = (response as { accessToken: string }).accessToken
  const refreshToken = (response as { refreshToken: string }).refreshToken
  const userId = (response as { userId: string }).userId.trim()

  try {
    const supabase = await getSupabase()
    const { data, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken
    })
    if (error || !data.session?.user?.id || data.session.user.id !== userId) {
      console.error('[FromExtensionAuth] setSession failed', error)
      status.value = 'Could not save the website session.'
      window.setTimeout(() => {
        window.location.replace(`/login?next=${encodeURIComponent(nextPath)}`)
      }, 1600)
      return
    }
    clearNavIsProCache()
    try {
      await ensureUiBridgeConnected()
      publishWebsiteAuthChanged({ signedIn: true, userId })
    } catch (bridgeError) {
      console.warn('[FromExtensionAuth] ui-bridge publish failed', bridgeError)
    }
    status.value = 'Signed in'
    window.location.replace(nextPath)
  } catch (error) {
    console.error('[FromExtensionAuth] setSession exception', error)
    status.value = 'Something went wrong. Try Sign in on this page.'
    window.setTimeout(() => {
      window.location.replace(`/login?next=${encodeURIComponent(nextPath)}`)
    }, 1600)
  }
})
</script>

<template>
  <p class="ui-status">{{ status }}</p>
</template>
