<script setup lang="ts">
/**
 * 扩展匿名 signup 用：渲染 Turnstile，成功后经 UI 桥回传 captcha token。
 * 不要求官网登录；不收集除 token 外的信息。
 */
import { onMounted, onUnmounted, ref } from 'vue'
import { t } from '../i18n/t'
import {
  isTurnstileConfigured,
  renderTurnstile,
  type TurnstileRenderHandle
} from '../services/turnstile'
import { publishWebsiteTurnstileToken } from '../services/ui-bridge'

defineOptions({ name: 'AuthTurnstileBridge' })

const statusText = ref('')
const turnstileHost = ref<HTMLElement | null>(null)
let turnstileHandle: TurnstileRenderHandle | null = null
let sent = false

function extensionIdFromUrl(): string {
  return new URLSearchParams(window.location.search).get('extension_id')?.trim() ?? ''
}

function onToken(token: string | null): void {
  if (!token || sent) {
    return
  }
  sent = true
  const extensionId = extensionIdFromUrl()
  publishWebsiteTurnstileToken(token, extensionId ? { extensionId } : undefined)
  statusText.value = t('turnstile.status.done')
}

onMounted(async () => {
  statusText.value = t('turnstile.status.loading')
  if (!isTurnstileConfigured()) {
    statusText.value = t('turnstile.status.unavailable')
    console.warn('[AuthTurnstileBridge] Turnstile site key missing')
    return
  }
  const host = turnstileHost.value
  if (!host) {
    statusText.value = t('turnstile.status.unavailable')
    console.warn('[AuthTurnstileBridge] host element missing')
    return
  }
  try {
    turnstileHandle = await renderTurnstile(host, onToken)
    statusText.value = t('turnstile.status.ready')
  } catch (error) {
    statusText.value = t('turnstile.status.unavailable')
    console.warn('[AuthTurnstileBridge] Turnstile render failed', error)
  }
})

onUnmounted(() => {
  turnstileHandle?.remove()
  turnstileHandle = null
})
</script>

<template>
  <div class="auth-turnstile-bridge">
    <p class="ui-status" role="status">{{ statusText }}</p>
    <div
      ref="turnstileHost"
      class="auth-turnstile-bridge__widget"
      :aria-label="t('login.turnstile.aria')"
    />
  </div>
</template>

<style scoped>
.auth-turnstile-bridge {
  max-width: 28rem;
  margin: 2.5rem auto;
  padding: 0 1rem;
  text-align: center;
}

.auth-turnstile-bridge__widget {
  display: flex;
  justify-content: center;
  min-height: 1.5rem;
  margin-top: 1rem;
}
</style>
