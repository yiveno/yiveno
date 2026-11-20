<script setup lang="ts">
/**
 * 扩展 → 官网反向接通确认页（G1-b）。
 * 加载时不自动铸会话；同账号短路；未登录 / 不同账号需用户 Continue。
 */
import { computed, onMounted, ref } from 'vue'
import { t } from '../i18n/t'
import { getSupabase } from '../services/supabase'
import { clearNavIsProCache } from '../services/nav-pro-badge-cache'
import { ensureUiBridgeConnected, publishWebsiteAuthChanged } from '../services/ui-bridge'
import { rememberConnectedExtensionId } from '../services/extension-auth-handoff'
import { decideFromExtensionAuthPhase } from './from-extension-auth-phase'

defineOptions({ name: 'FromExtensionAuth' })

type Phase =
  | 'loading' // 探测中
  | 'confirm_unsigned' // 官网未登录 → 确认铸会话
  | 'confirm_switch' // 官网已登录不同账号 → 确认切换
  | 'working' // 铸会话中
  | 'error' // 失败文案

const phase = ref<Phase>('loading')
const status = ref(t('from_extension.loading'))
const extensionIdRef = ref('')
const nextPathRef = ref('/account')
const extensionUserId = ref('')
const extensionEmail = ref('')
const extensionDisplayName = ref('')
const websiteUserId = ref('')
const websiteEmail = ref('')
/** 测试/调试：是否已发起铸会话（加载时必须为 false） */
const mintAttempted = ref(false)

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

function readProbeUser(probe: unknown): {
  signedIn: boolean
  userId: string
  email: string
  displayName: string
} {
  if (typeof probe !== 'object' || probe === null || (probe as { ok?: unknown }).ok !== true) {
    return { signedIn: false, userId: '', email: '', displayName: '' }
  }
  const row = probe as {
    signedIn?: unknown
    userId?: unknown
    email?: unknown
    displayName?: unknown
  }
  return {
    signedIn: row.signedIn === true,
    userId: typeof row.userId === 'string' ? row.userId.trim() : '',
    email: typeof row.email === 'string' ? row.email.trim() : '',
    displayName: typeof row.displayName === 'string' ? row.displayName.trim() : ''
  }
}

const extensionAccountLabel = computed(() => {
  return (
    extensionDisplayName.value ||
    extensionEmail.value ||
    (extensionUserId.value
      ? extensionUserId.value.slice(0, 8)
      : t('from_extension.unknown_account'))
  )
})

const websiteAccountLabel = computed(() => {
  return (
    websiteEmail.value ||
    (websiteUserId.value ? websiteUserId.value.slice(0, 8) : t('from_extension.unknown_account'))
  )
})

async function applyMintedSession(accessToken: string, refreshToken: string, userId: string) {
  const supabase = await getSupabase()
  const { data, error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken
  })
  if (error || !data.session?.user?.id || data.session.user.id !== userId) {
    throw new Error('set_session_failed')
  }
  clearNavIsProCache()
  try {
    await ensureUiBridgeConnected()
    publishWebsiteAuthChanged({ signedIn: true, userId })
  } catch (bridgeError) {
    console.warn('[FromExtensionAuth] ui-bridge publish failed', bridgeError)
  }
  window.location.replace(nextPathRef.value)
}

async function continueFromExtension(): Promise<void> {
  const extensionId = extensionIdRef.value
  if (!extensionId || mintAttempted.value) {
    return
  }
  mintAttempted.value = true
  phase.value = 'working'
  status.value = t('from_extension.signing_in')

  const response = await sendToExtension(extensionId, {
    type: 'YIVENO_WEBSITE_SESSION_REQUEST',
    payload: { nextPath: nextPathRef.value }
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
    phase.value = 'error'
    const err =
      typeof response === 'object' &&
      response !== null &&
      typeof (response as { error?: unknown }).error === 'string'
        ? (response as { error: string }).error
        : ''
    // 匿名设备无 email：明确引导转正，不得静默失败
    status.value =
      err === 'email_required'
        ? t('from_extension.error_email_required')
        : t('from_extension.error_mint')
    window.setTimeout(() => {
      window.location.replace(`/login?next=${encodeURIComponent(nextPathRef.value)}`)
    }, 1600)
    return
  }

  const accessToken = (response as { accessToken: string }).accessToken
  const refreshToken = (response as { refreshToken: string }).refreshToken
  const userId = (response as { userId: string }).userId.trim()

  try {
    await applyMintedSession(accessToken, refreshToken, userId)
  } catch (error) {
    console.error('[FromExtensionAuth] setSession failed', error)
    phase.value = 'error'
    status.value = t('from_extension.error_save')
    window.setTimeout(() => {
      window.location.replace(`/login?next=${encodeURIComponent(nextPathRef.value)}`)
    }, 1600)
  }
}

function cancelConfirm(): void {
  // 不做任何会话改动；停留在当前确认页
  phase.value = websiteUserId.value ? 'confirm_switch' : 'confirm_unsigned'
  status.value = t('from_extension.cancelled')
}

onMounted(async () => {
  const params = new URLSearchParams(window.location.search)
  const extensionId = params.get('extension_id')?.trim() ?? ''
  const nextPath = safeNextPath(params.get('next'))
  extensionIdRef.value = extensionId
  nextPathRef.value = nextPath

  if (!extensionId) {
    phase.value = 'error'
    status.value = t('from_extension.missing_extension')
    return
  }

  rememberConnectedExtensionId(extensionId)

  const probe = await sendToExtension(extensionId, {
    type: 'YIVENO_EXTENSION_AUTH_STATUS_PROBE',
    payload: {}
  })
  const extension = readProbeUser(probe)
  extensionUserId.value = extension.userId
  extensionEmail.value = extension.email
  extensionDisplayName.value = extension.displayName

  let websiteId = ''
  let websiteMail = ''
  try {
    const supabase = await getSupabase()
    const { data: existing } = await supabase.auth.getSession()
    websiteId = existing.session?.user?.id?.trim() ?? ''
    websiteMail = existing.session?.user?.email?.trim() ?? ''
  } catch (error) {
    console.warn('[FromExtensionAuth] existing session check failed', error)
  }

  const decided = decideFromExtensionAuthPhase({
    extensionId,
    extensionSignedIn: extension.signedIn,
    extensionUserId: extension.userId,
    websiteUserId: websiteId
  })

  // 加载路径禁止自动铸会话（mintAttempted 须仍为 false）
  if (decided === 'error_missing_extension') {
    phase.value = 'error'
    status.value = t('from_extension.missing_extension')
    return
  }
  if (decided === 'error_extension_unsigned') {
    phase.value = 'error'
    status.value = t('from_extension.extension_not_signed_in')
    return
  }
  if (decided === 'redirect_same') {
    status.value = t('from_extension.already_signed_in')
    window.location.replace(nextPath)
    return
  }
  if (decided === 'confirm_unsigned') {
    phase.value = 'confirm_unsigned'
    status.value = t('from_extension.copy_unsigned')
    return
  }

  websiteUserId.value = websiteId
  websiteEmail.value = websiteMail
  phase.value = 'confirm_switch'
  status.value = t('from_extension.copy_switch')
})
</script>

<template>
  <div class="from-extension" data-testid="from-extension-auth">
    <h1 class="from-extension__title">{{ t('from_extension.title') }}</h1>
    <p class="ui-status from-extension__status" role="status">{{ status }}</p>

    <template v-if="phase === 'confirm_unsigned' || phase === 'confirm_switch'">
      <dl class="from-extension__accounts">
        <div>
          <dt>{{ t('from_extension.extension_account') }}</dt>
          <dd>{{ extensionAccountLabel }}</dd>
        </div>
        <div v-if="phase === 'confirm_switch'">
          <dt>{{ t('from_extension.website_account') }}</dt>
          <dd>{{ websiteAccountLabel }}</dd>
        </div>
      </dl>
      <p v-if="phase === 'confirm_switch'" class="from-extension__warn">
        {{ t('from_extension.switch_warn') }}
      </p>
      <div class="from-extension__actions">
        <button
          type="button"
          class="from-extension__continue"
          data-testid="from-extension-continue"
          @click="continueFromExtension"
        >
          {{ t('from_extension.continue') }}
        </button>
        <button
          v-if="phase === 'confirm_switch'"
          type="button"
          class="from-extension__cancel"
          data-testid="from-extension-cancel"
          @click="cancelConfirm"
        >
          {{ t('from_extension.cancel') }}
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.from-extension {
  max-width: 28rem;
  margin: 2.5rem auto;
  padding: 0 1rem;
}

.from-extension__title {
  margin: 0 0 0.75rem;
  font-size: 1.25rem;
  font-weight: 600;
}

.from-extension__status {
  margin: 0 0 1rem;
  line-height: 1.45;
}

.from-extension__accounts {
  display: grid;
  gap: 0.75rem;
  margin: 0 0 1rem;
}

.from-extension__accounts dt {
  font-size: 0.75rem;
  opacity: 0.7;
}

.from-extension__accounts dd {
  margin: 0.15rem 0 0;
  font-weight: 500;
  word-break: break-word;
}

.from-extension__warn {
  margin: 0 0 1rem;
  line-height: 1.45;
}

.from-extension__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.from-extension__continue,
.from-extension__cancel {
  min-height: 2.5rem;
  padding: 0.5rem 1rem;
  border-radius: 0.5rem;
  border: 1px solid transparent;
  cursor: pointer;
  font: inherit;
}

.from-extension__continue {
  background: var(--color-fg, #111);
  color: var(--color-bg, #fff);
}

.from-extension__cancel {
  background: transparent;
  border-color: color-mix(in srgb, currentColor 25%, transparent);
}
</style>
