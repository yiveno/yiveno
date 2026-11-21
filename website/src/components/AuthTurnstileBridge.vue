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
/** 成功后自关 / 错误路径延时自关；卸载时必须 clear，避免关到用户已导航去的页 */
let closeTimerId: ReturnType<typeof setTimeout> | null = null

function extensionIdFromUrl(): string {
  return new URLSearchParams(window.location.search).get('extension_id')?.trim() ?? ''
}

/** 脚本打开的 tab 可关；手动打开关不掉是预期，由扩展清扫兜底。 */
function scheduleWindowClose(delayMs: number): void {
  if (closeTimerId != null) {
    clearTimeout(closeTimerId)
  }
  closeTimerId = setTimeout(() => {
    closeTimerId = null
    try {
      window.close()
    } catch {
      /* 非脚本打开的页关不掉，忽略 */
    }
  }, delayMs)
}

function onToken(token: string | null): void {
  if (!token || sent) {
    return
  }
  sent = true
  const extensionId = extensionIdFromUrl()
  publishWebsiteTurnstileToken(token, extensionId ? { extensionId } : undefined)
  statusText.value = t('turnstile.status.done')
  // 500ms：给 Port fire-and-forget 留 flush 时间
  scheduleWindowClose(500)
}

onMounted(async () => {
  statusText.value = t('turnstile.status.loading')
  if (!isTurnstileConfigured()) {
    statusText.value = t('turnstile.status.unavailable')
    console.warn('[AuthTurnstileBridge] Turnstile site key missing')
    scheduleWindowClose(30_000)
    return
  }
  const host = turnstileHost.value
  if (!host) {
    statusText.value = t('turnstile.status.unavailable')
    console.warn('[AuthTurnstileBridge] host element missing')
    scheduleWindowClose(30_000)
    return
  }
  try {
    turnstileHandle = await renderTurnstile(host, onToken)
    statusText.value = t('turnstile.status.ready')
  } catch (error) {
    statusText.value = t('turnstile.status.unavailable')
    console.warn('[AuthTurnstileBridge] Turnstile render failed', error)
    scheduleWindowClose(30_000)
  }
})

onUnmounted(() => {
  if (closeTimerId != null) {
    clearTimeout(closeTimerId)
    closeTimerId = null
  }
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
