<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { getSession, signInWithOAuth, signOut } from '../services/auth'
import {
  captureExtensionConnectParamsFromUrl,
  extractProfileFromUserMetadata,
  getPendingExtensionId,
  handoffSessionToExtension
} from '../services/extension-auth-handoff'

const loading = ref(false)
const error = ref('')
const connectingExtension = ref(false)
const extensionConnected = ref(false)
const fromExtension = ref(false)
/** 已有本地会话时展示，便于换账号而不是被直接踢进 /account */
const signedInEmail = ref('')

async function tryHandoffCurrentSession(): Promise<boolean> {
  if (!getPendingExtensionId()) {
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
    no_token: '登录回调未带回凭证',
    session_error: '登录会话写入失败',
    auth_error: '登录处理异常',
    oauth_error: 'OAuth 提供商或 Supabase 拒绝了登录'
  }
  const label = labels[code] || code
  error.value = detail ? `${label}：${detail}` : label
}

/**
 * 已登录：来自扩展则回传；否则停在登录页展示当前账号，可进账户或换号。
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
    if (getPendingExtensionId()) {
      const ok = await tryHandoffCurrentSession()
      if (ok) {
        window.location.replace('/account?extension_connected=1')
        return
      }
      error.value = '已登录，但未能连接到扩展。请确认已安装并启用 Yiveno 扩展后重试。'
      return
    }
    signedInEmail.value = session.user.email || session.user.id
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : '检查登录状态失败'
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
    if (signedInEmail.value || (await getSession())) {
      await signOut()
      signedInEmail.value = ''
    }
    await signInWithOAuth(provider)
  } catch (e: unknown) {
    error.value = (e instanceof Error ? e.message : String(e)) || '登录失败'
    loading.value = false
  }
}
</script>

<template>
  <div class="login-form">
    <h2>登录 Yiveno</h2>
    <p v-if="fromExtension" class="hint">登录后将同步到 Chrome 扩展（不会自动上传记忆）。</p>
    <p v-if="connectingExtension" class="hint">正在连接扩展…</p>
    <p v-if="extensionConnected" class="ok">扩展已连接</p>
    <template v-if="signedInEmail">
      <p class="hint">当前已登录：{{ signedInEmail }}</p>
      <button :disabled="loading || connectingExtension" class="btn btn-primary" @click="goAccount">
        进入账户
      </button>
      <p class="hint">或使用下方按钮切换其他账号</p>
    </template>
    <p v-if="error" class="error">{{ error }}</p>
    <button :disabled="loading || connectingExtension" class="btn" @click="login('google')">
      {{ loading ? '跳转中...' : signedInEmail ? '换 Google 账号' : '使用 Google 登录' }}
    </button>
    <button :disabled="loading || connectingExtension" class="btn" @click="login('microsoft')">
      {{ loading ? '跳转中...' : signedInEmail ? '换 Microsoft 账号' : '使用 Microsoft 登录' }}
    </button>
  </div>
</template>

<style scoped>
.login-form {
  max-width: 360px;
  margin: 4rem auto;
  text-align: center;
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
</style>
