<script setup lang="ts">
/**
 * 扩展 → 官网反向接通（G1-b；RV1 修订）。
 * 同账号短路；官网未登录时加载即自动铸会话（点扩展头像即是手势）；官网已登录不同账号时仍需用户确认才切换。
 */
import { computed, onMounted, ref } from 'vue'
import { t } from '../i18n/t'
import { getSupabase } from '../services/supabase'
import { clearNavIsProCache } from '../services/nav-pro-badge-cache'
import { ensureUiBridgeConnected, publishWebsiteAuthChanged } from '../services/ui-bridge'
import {
  rememberConnectedExtensionId,
  rememberFromExtensionSignInArrival
} from '../services/extension-auth-handoff'
import { decideFromExtensionAuthPhase } from './from-extension-auth-phase'

defineOptions({ name: 'FromExtensionAuth' })

type Phase =
  | 'loading' // 探测中
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
/** 是否已发起铸会话（每页加载最多一次；未登录自动路径在加载时即发起） */
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

async function applyMintedSession(
  accessToken: string,
  refreshToken: string,
  userId: string,
  auto: boolean
) {
  const supabase = await getSupabase()
  const { data, error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken
  })
  if (error || !data.session?.user?.id || data.session.user.id !== userId) {
    throw new Error('set_session_failed')
  }
  if (auto) {
    rememberFromExtensionSignInArrival(extensionAccountLabel.value)
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

async function continueFromExtension(options?: { auto?: boolean }): Promise<void> {
  const auto = options?.auto === true
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
    await applyMintedSession(accessToken, refreshToken, userId, auto)
  } catch (error) {
    console.error('[FromExtensionAuth] setSession failed', error)
    phase.value = 'error'
    status.value = t('from_extension.error_save')
    window.setTimeout(() => {
      window.location.replace(`/login?next=${encodeURIComponent(nextPathRef.value)}`)
    }, 1600)
  }
}

function keepCurrentAccount(): void {
  // 保留官网当前账号：不铸会话、不改登录态，直接去目标页
  window.location.replace(nextPathRef.value)
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
  if (decided === 'auto_sign_in') {
    await continueFromExtension({ auto: true })
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

    <template v-if="phase === 'confirm_switch'">
      <dl class="from-extension__accounts">
        <div>
          <dt>{{ t('from_extension.extension_account') }}</dt>
          <dd>{{ extensionAccountLabel }}</dd>
        </div>
        <div>
          <dt>{{ t('from_extension.website_account') }}</dt>
          <dd>{{ websiteAccountLabel }}</dd>
        </div>
      </dl>
      <p class="from-extension__warn">
        {{ t('from_extension.switch_warn') }}
      </p>
      <div class="from-extension__actions">
        <button
          type="button"
          class="from-extension__continue"
          data-testid="from-extension-continue"
          @click="continueFromExtension()"
        >
          {{ t('from_extension.continue') }}
        </button>
        <button
          type="button"
          class="from-extension__cancel"
          data-testid="from-extension-keep-current"
          @click="keepCurrentAccount"
        >
          {{ t('from_extension.keep_current') }}
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.from-extension {
  max-width: 28rem;
  margin: 2.5rem auto;
  padding: 0 var(--space-md);
}

.from-extension__title {
  margin: 0 0 var(--space-sm);
  font-size: var(--text-title);
  font-weight: var(--font-weight-semibold);
}

.from-extension__status {
  margin: 0 0 var(--space-md);
  line-height: 1.45;
}

.from-extension__accounts {
  display: grid;
  gap: var(--space-sm);
  margin: 0 0 var(--space-md);
}

.from-extension__accounts dt {
  font-size: var(--text-caption);
  opacity: 0.7;
}

.from-extension__accounts dd {
  margin: 0.15rem 0 0;
  font-weight: var(--font-weight-medium);
  word-break: break-word;
}

.from-extension__warn {
  margin: 0 0 var(--space-md);
  line-height: 1.45;
}

.from-extension__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
}

.from-extension__continue,
.from-extension__cancel {
  min-height: 2.5rem;
  padding: var(--space-xs) var(--space-md);
  border-radius: 0.5rem;
  border: 1px solid transparent;
  cursor: pointer;
  font: inherit;
}

.from-extension__continue {
  background: #111;
  color: var(--surface-white);
}

.from-extension__cancel {
  background: transparent;
  border-color: color-mix(in srgb, currentColor 25%, transparent);
}
</style>
