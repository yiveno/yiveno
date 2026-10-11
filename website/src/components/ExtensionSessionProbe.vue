<script setup lang="ts">
/**
 * 扩展 Side Panel 探测「官网是否已登录」：只回传 signedIn，不 mint / 不 handoff session。
 */
import { onMounted, ref } from 'vue'
import { getSupabase } from '../services/supabase'

defineOptions({ name: 'ExtensionSessionProbe' })

const status = ref('Checking…')

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

function notifyExtension(extensionId: string, signedIn: boolean): Promise<void> {
  const runtime = getChromeRuntime()
  if (!runtime?.sendMessage) {
    return Promise.resolve()
  }
  return new Promise(resolve => {
    try {
      runtime.sendMessage(
        extensionId,
        { type: 'YIVENO_WEBSITE_AUTH_PROBE', payload: { signedIn } },
        () => {
          void runtime.lastError
          resolve()
        }
      )
    } catch {
      resolve()
    }
  })
}

onMounted(async () => {
  const extensionId = new URLSearchParams(window.location.search).get('extension_id')?.trim() ?? ''
  if (!extensionId) {
    status.value = 'Missing extension.'
    return
  }

  let signedIn = false
  try {
    const supabase = await getSupabase()
    const { data } = await supabase.auth.getSession()
    signedIn = Boolean(data.session?.access_token)
  } catch (error) {
    console.warn('[ExtensionSessionProbe] getSession failed', error)
  }

  status.value = signedIn ? 'Signed in' : 'Not signed in'
  await notifyExtension(extensionId, signedIn)
  window.setTimeout(() => {
    window.close()
  }, 120)
})
</script>

<template>
  <p class="ui-status">{{ status }}</p>
</template>
