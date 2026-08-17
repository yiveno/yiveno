<script setup lang="ts">
import type { User } from '@supabase/supabase-js'
import { onMounted, onUnmounted, ref, computed } from 'vue'
import { getSupabase } from '../services/supabase'
import {
  getUserSubscription,
  isActiveProSnapshot,
  type UserSubscription
} from '../services/subscription'
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

const isPro = computed(() => isActiveProSnapshot(subscription.value))

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
  try {
    await loadSubscription()
    if (isPro.value) {
      console.warn('[Account] 已是有效 Pro，跳过 checkout')
      checkoutError.value = 'This account already has Pro. Manage it from your subscription.'
      return
    }
    const result = await createCheckoutSession(accessToken.value, 'pro_monthly')
    if (result.status === 'already_subscribed') {
      await loadSubscription()
      console.warn('[Account] Worker 判定已是 Pro，拒绝新 checkout')
      checkoutError.value = 'This account already has Pro. Manage it from your subscription.'
      return
    }
    if (result.status !== 'ok') {
      checkoutError.value = 'Could not start checkout. Try again.'
      return
    }
    window.location.assign(result.checkoutUrl)
  } finally {
    checkoutBusy.value = false
  }
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
  window.location.href = '/login'
}
</script>

<template>
  <div v-if="!loading" class="account-page page">
    <div v-if="user" class="card">
      <div class="user-header">
        <img v-if="profileAvatarUrl" :src="profileAvatarUrl" class="avatar" alt="" />
        <div>
          <h1 class="account-title">{{ profileDisplayName || user.email }}</h1>
          <p class="email">{{ user.email }}</p>
        </div>
      </div>
      <section>
        <h2>Subscription</h2>
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
          Free and Pro share the same on-device recall quality. Pro adds cloud sync across devices
          and a larger hosted clue-understanding quota.
        </p>
        <div class="actions">
          <button
            v-if="!isPro"
            class="ui-btn ui-btn--primary"
            type="button"
            :disabled="checkoutBusy"
            @click="startMonthlyCheckout"
          >
            {{ checkoutBusy ? 'Opening…' : 'Upgrade to Pro' }}
          </button>
          <button v-if="isPro" class="ui-btn" type="button" @click="openPortal">
            Manage subscription
          </button>
          <a class="ui-btn ui-btn--ghost" href="/pricing">View pricing</a>
        </div>
        <p class="hint">
          Need a refund or other help?
          <a href="/support">Support</a>
          — cancellations are in Manage subscription; refunds go through Dodo Payments.
        </p>
        <p v-if="checkoutError" class="hint error">{{ checkoutError }}</p>
      </section>
      <section>
        <h2>Account</h2>
        <dl>
          <dt>Sign-in</dt>
          <dd>{{ user.app_metadata?.provider || 'Unknown' }}</dd>
          <dt>Joined</dt>
          <dd>{{ formatDate(user.created_at) }}</dd>
          <dt>Last sign-in</dt>
          <dd>{{ formatDate(user.last_sign_in_at) }}</dd>
        </dl>
      </section>
      <button class="ui-btn" @click="handleSignOut">Sign out</button>
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
  <div v-else class="ui-status">Loading…</div>
</template>

<style scoped>
.account-page {
  max-width: 600px;
}

.card {
  background: var(--paper);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: clamp(24px, 3vw, 36px);
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

.account-title {
  margin: 0;
  font-family: var(--font-display);
  font-weight: 400;
  font-size: clamp(22px, 3vw, 28px);
  letter-spacing: -0.02em;
  color: var(--ink);
  line-height: 1.2;
}

.email {
  color: var(--sage-muted);
  margin: 0.25rem 0 0;
  font-size: 14px;
  font-weight: 300;
}

section {
  margin-bottom: 1.5rem;
}

h2 {
  margin: 0 0 0.5rem;
  font-family: var(--font-display);
  font-weight: 400;
  font-size: 18px;
  letter-spacing: -0.015em;
  color: var(--ink);
}

section p {
  margin: 0.35rem 0;
  font-size: 14.5px;
  font-weight: 300;
  line-height: 1.55;
  color: var(--muted);
}

.hint {
  color: var(--sage-muted);
  font-size: 0.9rem;
  line-height: 1.5;
}

.hint a {
  color: var(--sage);
}

.hint.error {
  color: var(--danger);
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
  font-size: 14.5px;
  font-weight: 300;
}

dt {
  color: var(--sage-muted);
}

dd {
  margin: 0;
  color: var(--charcoal);
}

.sign-out-hint {
  margin-top: 0.75rem;
  color: var(--sage-muted);
  font-size: 0.85rem;
  font-weight: 300;
}

.extension-sync-ok {
  color: var(--sage);
}

.extension-sync-fail {
  color: var(--danger);
}
</style>
