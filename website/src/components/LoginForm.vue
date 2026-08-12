<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { getSession, signInWithOAuth, signOut } from '../services/auth'
import {
  captureExtensionConnectParamsFromUrl,
  extractProfileFromUserMetadata,
  getPendingExtensionId,
  handoffSessionToExtension,
  resolveExtensionHandoffTargetId
} from '../services/extension-auth-handoff'

const loading = ref(false)
const error = ref('')
const connectingExtension = ref(false)
const extensionConnected = ref(false)
const fromExtension = ref(false)
/** 已有本地会话时展示，便于换账号而不是被直接踢进 /account */
const signedInEmail = ref('')

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
 * 已登录：有扩展目标则回传；否则停在登录页展示当前账号，可进账户或换号。
 */
onMounted(async () => {
  captureExtensionConnectParamsFromUrl()
  fromExtension.value = Boolean(getPendingExtensionId())
  applyLoginErrorFromUrl()
  try {
    const session = await getSession()
    if (!session) {
      return
    }
    if (resolveExtensionHandoffTargetId()) {
      const ok = await tryHandoffCurrentSession()
      if (ok) {
        window.location.replace('/account?extension_connected=1')
        return
      }
      if (getPendingExtensionId()) {
        error.value =
          'You are signed in, but we could not reach the extension. Install and enable Yiveno, then try again.'
        return
      }
    }
    signedInEmail.value = session.user.email || session.user.id
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Could not check sign-in status'
    error.value = message
  }
})

function goAccount(): void {
  window.location.href = '/account'
}

async function login(provider: 'google' | 'microsoft') {
  loading.value = true
  error.value = ''
  try {
    captureExtensionConnectParamsFromUrl()
    fromExtension.value = Boolean(getPendingExtensionId())
    // 换账号：先清本地会话，再走 OAuth 账号选择器
    if (await getSession()) {
      await signOut()
    }
    signedInEmail.value = ''
    await signInWithOAuth(provider)
  } catch (e: unknown) {
    error.value = (e instanceof Error ? e.message : String(e)) || 'Sign-in failed'
    loading.value = false
  }
}
</script>

<template>
  <div class="login-form">
    <img
      class="login-form__logo"
      src="/images/logo-mark.svg"
      alt=""
      width="56"
      height="56"
      decoding="async"
    />
    <h2>Sign in to Yiveno</h2>
    <p v-if="fromExtension" class="hint">
      After sign-in, your session syncs to the Chrome extension. Memories are not uploaded
      automatically.
    </p>
    <p v-if="connectingExtension" class="hint">Connecting to the extension…</p>
    <p v-if="extensionConnected" class="ok">Extension connected</p>
    <template v-if="signedInEmail">
      <p class="hint">Signed in as {{ signedInEmail }}</p>
      <button :disabled="loading || connectingExtension" class="btn btn-primary" @click="goAccount">
        Go to account
      </button>
      <p class="hint">Or use the buttons below to switch accounts</p>
    </template>
    <p v-if="error" class="error">{{ error }}</p>
    <button :disabled="loading || connectingExtension" class="btn" @click="login('google')">
      {{
        loading ? 'Redirecting…' : signedInEmail ? 'Switch Google account' : 'Continue with Google'
      }}
    </button>
    <button :disabled="loading || connectingExtension" class="btn" @click="login('microsoft')">
      {{
        loading
          ? 'Redirecting…'
          : signedInEmail
            ? 'Switch Microsoft account'
            : 'Continue with Microsoft'
      }}
    </button>
    <p class="legal">
      <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
      ·
      <a href="/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a>
    </p>
  </div>
</template>

<style scoped>
.login-form {
  max-width: 360px;
  margin: 4rem auto;
  text-align: center;
}

.login-form__logo {
  display: block;
  width: 56px;
  height: 56px;
  margin: 0 auto 1rem;
  object-fit: contain;
}

.btn {
  display: block;
  width: 100%;
  padding: 0.75rem;
  margin: 0.5rem 0;
  border: 1px solid #ddd;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  font-size: 1rem;
}

.btn:hover {
  background: #f5f5f5;
}

.btn-primary {
  background: #111;
  color: #fff;
  border-color: #111;
}

.btn-primary:hover {
  background: #333;
  color: #fff;
}

.btn:disabled {
  opacity: 0.5;
}

.error {
  color: #e53e3e;
  font-size: 0.875rem;
}

.hint {
  color: #666;
  font-size: 0.875rem;
  line-height: 1.4;
}

.ok {
  color: #2f855a;
  font-size: 0.875rem;
}

.legal {
  margin-top: 1.25rem;
  font-size: 0.8rem;
  color: #666;
}

.legal a {
  color: #555;
}
</style>
