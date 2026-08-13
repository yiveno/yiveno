<script setup lang="ts">
import type { User } from '@supabase/supabase-js'
import { onMounted, onUnmounted, ref, computed } from 'vue'
import { getSupabase } from '../services/supabase'
import { getUserSubscription, type UserSubscription } from '../services/subscription'
import { formatDate } from '../services/date'
import {
  captureExtensionConnectParamsFromUrl,
  extractProfileFromUserMetadata,
  handoffSessionToExtension,
  handoffSignOutToExtension,
  primeExtensionHandoffTarget,
  resolveExtensionHandoffTargetId
} from '../services/extension-auth-handoff'
import { createCheckoutSession, createPortalSession } from '../services/billing'

defineOptions({ name: 'AccountPage' })

const user = ref<User | null>(null)
const profileAvatarUrl = ref('')
const profileDisplayName = ref('')
const subscription = ref<UserSubscription | null>(null)
const accessToken = ref<string | null>(null)
const loading = ref(true)
const extensionSyncStatus = ref<'idle' | 'syncing' | 'ok' | 'skipped' | 'failed'>('idle')

const isPro = computed(
  () => subscription.value?.tier === 'pro' && subscription.value?.status === 'active'
)

const checkoutBusy = ref(false)
const checkoutError = ref('')

/** 从 Worker 拉订阅（含对账）；进页 / 从 checkout 返回时自动调用。 */
async function loadSubscription(): Promise<void> {
  if (!accessToken.value) return
  const sub = await getUserSubscription(accessToken.value)
  subscription.value = sub
}

function refreshSubscriptionOnVisible(): void {
  if (document.visibilityState !== 'visible') return
  void loadSubscription()
}

async function startMonthlyCheckout(): Promise<void> {
  if (!accessToken.value) return
  checkoutError.value = ''
  checkoutBusy.value = true
  const url = await createCheckoutSession(accessToken.value, 'pro_monthly')
  checkoutBusy.value = false
  if (!url) {
    checkoutError.value = 'Could not start checkout. Try again.'
    return
  }
  window.location.assign(url)
}

async function openPortal(): Promise<void> {
  if (!accessToken.value) return
  const url = await createPortalSession(accessToken.value)
  if (url) window.location.assign(url)
}

/** 官网已登录时补推 session 到扩展（账户页 / URL 带 extension_id / 上次连接过）。 */
async function syncSessionToExtension(session: {
  access_token: string
  refresh_token: string
  user: User
  expires_at?: number
}): Promise<void> {
  if (!resolveExtensionHandoffTargetId()) {
    extensionSyncStatus.value = 'skipped'
    return
  }
  if (!session.refresh_token) {
    extensionSyncStatus.value = 'failed'
    return
  }
  extensionSyncStatus.value = 'syncing'
  const profile = extractProfileFromUserMetadata(
    session.user.user_metadata as Record<string, unknown> | undefined
  )
  try {
    const ok = await handoffSessionToExtension({
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      userId: session.user.id,
      ...(session.user.email ? { email: session.user.email } : {}),
      ...(session.expires_at != null ? { expiresAt: session.expires_at } : {}),
      ...profile
    })
    extensionSyncStatus.value = ok ? 'ok' : 'failed'
  } catch (error) {
    console.warn('[AccountPage] extension session handoff failed', error)
    extensionSyncStatus.value = 'failed'
  }
}

onMounted(async () => {
  captureExtensionConnectParamsFromUrl()
  const params = new URLSearchParams(window.location.search)
  const extensionId = params.get('extension_id')?.trim()
  if (extensionId) {
    primeExtensionHandoffTarget(extensionId)
  }

  const supabase = await getSupabase()
  const { data } = await supabase.auth.getSession()
  if (!data?.session?.user) {
    window.location.replace('/login')
    return
  }
  user.value = data.session.user
  accessToken.value = data.session.access_token
  const profile = extractProfileFromUserMetadata(
    data.session.user.user_metadata as Record<string, unknown> | undefined
  )
  profileAvatarUrl.value = profile.avatarUrl ?? ''
  profileDisplayName.value = profile.displayName ?? data.session.user.email ?? ''
  await loadSubscription()
  loading.value = false
  document.addEventListener('visibilitychange', refreshSubscriptionOnVisible)
  void syncSessionToExtension(data.session)
})

onUnmounted(() => {
  document.removeEventListener('visibilitychange', refreshSubscriptionOnVisible)
})

async function handleSignOut() {
  const supabase = await getSupabase()
  await supabase.auth.signOut()
  try {
    await handoffSignOutToExtension()
  } catch (error) {
    console.warn('[AccountPage] extension sign-out handoff failed', error)
  }
  window.location.href = '/'
}
</script>

<template>
  <div v-if="!loading" class="account-page">
    <div v-if="user" class="card">
      <div class="user-header">
        <img v-if="profileAvatarUrl" :src="profileAvatarUrl" class="avatar" alt="" />
        <div>
          <h2>{{ profileDisplayName || user.email }}</h2>
          <p class="email">{{ user.email }}</p>
        </div>
      </div>
      <section>
        <h3>Subscription</h3>
        <p>
          Plan:
          <strong>{{ isPro ? 'Pro' : 'Free' }}</strong>
        </p>
        <p v-if="isPro && subscription?.status">
          Status: {{ subscription.status }}
          <template v-if="subscription.currentPeriodEnd">
            · Renews / ends {{ formatDate(subscription.currentPeriodEnd) }}
          </template>
        </p>
        <p class="hint">
          Free and Pro share the same on-device recall quality (keyword + Hybrid). Pro adds cloud
          sync across devices and a larger hosted clue-understanding quota.
        </p>
        <div class="actions">
          <button
            v-if="!isPro"
            class="btn btn-primary"
            type="button"
            :disabled="checkoutBusy"
            @click="startMonthlyCheckout"
          >
            {{ checkoutBusy ? 'Opening…' : 'Upgrade to Pro' }}
          </button>
          <button v-if="isPro" class="btn" type="button" @click="openPortal">
            Manage subscription
          </button>
        </div>
        <p class="hint">
          Need a refund or other help?
          <a href="/support">Support</a>
          — cancellations are in Manage subscription; refunds go through Paddle.
        </p>
        <p v-if="checkoutError" class="hint">{{ checkoutError }}</p>
      </section>
      <section>
        <h3>Account</h3>
        <dl>
          <dt>Sign-in</dt>
          <dd>{{ user.app_metadata?.provider || 'Unknown' }}</dd>
          <dt>Joined</dt>
          <dd>{{ formatDate(user.created_at) }}</dd>
          <dt>Last sign-in</dt>
          <dd>{{ formatDate(user.last_sign_in_at) }}</dd>
        </dl>
      </section>
      <button class="btn" @click="handleSignOut">Sign out</button>
      <p class="sign-out-hint">
        Extension memories stay on your device. Clear them from extension Settings if needed.
      </p>
      <p v-if="extensionSyncStatus === 'ok'" class="sign-out-hint extension-sync-ok">
        Extension login synced.
      </p>
      <p v-else-if="extensionSyncStatus === 'failed'" class="sign-out-hint extension-sync-fail">
        Could not sync login to the extension. Open Yiveno extension → account icon → Sign in once.
      </p>
      <p v-else-if="extensionSyncStatus === 'skipped'" class="sign-out-hint">
        To sync login to the extension, open it and tap the account icon (Sign in).
      </p>
    </div>
  </div>
  <div v-else class="loading">Loading…</div>
</template>

<style scoped>
.account-page {
  max-width: 600px;
  margin: 2rem auto;
  padding: 0 1rem;
}

.card {
  background: #fff;
  border: 1px solid #eee;
  border-radius: 12px;
  padding: 2rem;
}

.user-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.avatar {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  object-fit: cover;
}

.email {
  color: #666;
  margin: 0.25rem 0 0;
}

section {
  margin-bottom: 1.5rem;
}

h3 {
  margin: 0 0 0.5rem;
  font-size: 1rem;
}

.hint {
  color: #666;
  font-size: 0.9rem;
  line-height: 1.5;
}

.hint a {
  color: #1e2640;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 1rem;
}

dl {
  display: grid;
  grid-template-columns: 8rem 1fr;
  gap: 0.5rem 1rem;
  margin: 0;
}

dt {
  color: #666;
}

dd {
  margin: 0;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.6rem 1rem;
  border: 1px solid #ddd;
  border-radius: 8px;
  background: #f7f7f7;
  color: inherit;
  text-decoration: none;
  cursor: pointer;
  font: inherit;
}

.btn:disabled {
  opacity: 0.6;
  cursor: default;
}

.btn-primary {
  background: #111;
  color: #fff;
  border-color: #111;
}

.sign-out-hint {
  margin-top: 0.75rem;
  color: #777;
  font-size: 0.85rem;
}

.extension-sync-ok {
  color: #2a7a3a;
}

.extension-sync-fail {
  color: #a33;
}

.loading {
  text-align: center;
  padding: 3rem;
  color: #666;
}
</style>
