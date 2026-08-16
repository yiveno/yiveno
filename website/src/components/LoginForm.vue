<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { getSession, signInWithOAuth, signOut } from '../services/auth'
import {
  buildPostAuthHref,
  captureAuthReturnFromUrl,
  peekAuthReturn
} from '../services/auth-return'
import {
  captureExtensionConnectParamsFromUrl,
  extractProfileFromUserMetadata,
  getPendingExtensionId,
  handoffSessionToExtension,
  resolveExtensionHandoffTargetId
} from '../services/extension-auth-handoff'

defineOptions({ name: 'LoginForm' })

const loading = ref(false)
const error = ref('')
const connectingExtension = ref(false)
const extensionConnected = ref(false)
const fromExtension = ref(false)
/** 来自定价页 Subscribe：登录后回跳续付 */
const fromSubscribe = ref(false)
/** 已登录且正在跳转账户页时，避免闪一下登录按钮 */
const redirecting = ref(false)

async function tryHandoffCurrentSession(): Promise<boolean> {
  if (!resolveExtensionHandoffTargetId()) {
    return false
  }
  connectingExtension.value = true
  try {
    const session = await getSession()
    if (!session?.access_token || !session.refresh_token || !session.user?.id) {
      return false
    }
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
    extensionConnected.value = ok
    return ok
  } finally {
    connectingExtension.value = false
  }
}

/** 将回调失败的 query 展示到页面，便于排查 OAuth / Azure 配置 */
function applyLoginErrorFromUrl(): void {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('error')
  if (!code) {
    return
  }
  const detail = params.get('detail')
  const labels: Record<string, string> = {
    no_token: 'Sign-in callback did not return credentials',
    session_error: 'Could not save your sign-in session',
    auth_error: 'Sign-in failed unexpectedly',
    oauth_error: 'OAuth provider or Supabase rejected sign-in'
  }
  const label = labels[code] || code
  error.value = detail ? `${label}: ${detail}` : label
}

/**
 * 已登录：扩展 handoff / 续付 next 优先；否则直接进账户页。
 */
onMounted(async () => {
  captureExtensionConnectParamsFromUrl()
  captureAuthReturnFromUrl()
  fromExtension.value = Boolean(getPendingExtensionId())
  fromSubscribe.value = peekAuthReturn().intent === 'subscribe'
  applyLoginErrorFromUrl()
  try {
    const session = await getSession()
    if (!session) {
      return
    }
    // 仅 sessionStorage 的 connect_extension，不用 lastConnected（否则会抢走续付回跳）
    if (getPendingExtensionId()) {
      const ok = await tryHandoffCurrentSession()
      if (ok) {
        redirecting.value = true
        window.location.replace('/account?extension_connected=1')
        return
      }
      error.value =
        'You are signed in, but we could not reach the extension. Install and enable Yiveno, then try again.'
      return
    }
    const pending = peekAuthReturn()
    if (pending.next) {
      if (resolveExtensionHandoffTargetId()) {
        void tryHandoffCurrentSession()
      }
      console.warn('[LoginForm] 已登录，回跳续意图', pending)
      redirecting.value = true
      window.location.replace(buildPostAuthHref('/account'))
      return
    }
    redirecting.value = true
    window.location.replace(buildPostAuthHref('/account'))
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Could not check sign-in status'
    error.value = message
  }
})

async function login(provider: 'google' | 'microsoft') {
  loading.value = true
  error.value = ''
  try {
    captureExtensionConnectParamsFromUrl()
    captureAuthReturnFromUrl()
    fromExtension.value = Boolean(getPendingExtensionId())
    fromSubscribe.value = peekAuthReturn().intent === 'subscribe'
    // 换账号：先清本地会话，再走 OAuth 账号选择器
    if (await getSession()) {
      await signOut()
    }
    await signInWithOAuth(provider)
  } catch (e: unknown) {
    error.value = (e instanceof Error ? e.message : String(e)) || 'Sign-in failed'
    loading.value = false
  }
}
</script>

<template>
  <div class="login-form page page--narrow page--center">
    <img
      class="login-form__logo"
      src="/images/logo-mark.svg"
      alt=""
      width="56"
      height="56"
      decoding="async"
    />
    <h1 class="page__title">Sign in to Yiveno</h1>
    <p v-if="redirecting" class="hint">Taking you to your account…</p>
    <template v-else>
      <p v-if="fromSubscribe" class="hint">
        Sign in to continue checkout. After Google or Microsoft, we'll bring you back to pricing and
        open payment.
      </p>
      <p v-else-if="fromExtension" class="hint">
        After sign-in, your session syncs to the Chrome extension. Memories are not uploaded
        automatically.
      </p>
      <p v-if="connectingExtension" class="hint">Connecting to the extension…</p>
      <p v-if="extensionConnected" class="ok">Extension connected</p>
      <p v-if="error" class="error">{{ error }}</p>
      <button
        type="button"
        :disabled="loading || connectingExtension"
        class="ui-btn ui-btn--block login-form__oauth"
        @click="login('google')"
      >
        <svg class="login-form__icon" width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"
          />
          <path
            fill="#34A853"
            d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
          />
          <path
            fill="#FBBC05"
            d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"
          />
          <path
            fill="#EA4335"
            d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z"
          />
        </svg>
        <span>{{ loading ? 'Redirecting…' : 'Continue with Google' }}</span>
      </button>
      <button
        type="button"
        :disabled="loading || connectingExtension"
        class="ui-btn ui-btn--block login-form__oauth"
        @click="login('microsoft')"
      >
        <svg class="login-form__icon" width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <path fill="#F25022" d="M0 0h8.5v8.5H0z" />
          <path fill="#7FBA00" d="M9.5 0H18v8.5H9.5z" />
          <path fill="#00A4EF" d="M0 9.5h8.5V18H0z" />
          <path fill="#FFB900" d="M9.5 9.5H18V18H9.5z" />
        </svg>
        <span>{{ loading ? 'Redirecting…' : 'Continue with Microsoft' }}</span>
      </button>
    </template>
  </div>
</template>

<style scoped>
.login-form .page__title {
  font-size: clamp(28px, 4vw, 36px);
  margin-bottom: 12px;
}

.login-form__logo {
  display: block;
  width: 56px;
  height: 56px;
  margin: 0 auto 1rem;
  object-fit: contain;
  opacity: 0.9;
}

.login-form .ui-btn {
  margin: 0.5rem 0 0;
}

.login-form__oauth {
  gap: 10px;
}

.login-form__icon {
  flex-shrink: 0;
}

.hint {
  color: var(--muted);
  font-size: 0.875rem;
  font-weight: 300;
  line-height: 1.5;
  margin: 0 0 0.75rem;
}

.error {
  color: var(--danger);
  font-size: 0.875rem;
  font-weight: 300;
}

.ok {
  color: var(--sage);
  font-size: 0.875rem;
  font-weight: 300;
}
</style>
