<script setup lang="ts">
import type { User } from '@supabase/supabase-js'
import { onMounted, onUnmounted, ref, computed } from 'vue'
import { getSupabase } from '../services/supabase'
import {
  isActiveProSnapshot,
  loadUserSubscription,
  type UserSubscription
} from '../services/subscription'
import { formatDate } from '../services/date'
import {
  captureExtensionConnectParamsFromUrl,
  clearExtensionConnectParams,
  extractProfileFromUserMetadata,
  rememberConnectedExtensionId
} from '../services/extension-auth-handoff'
import { runExtensionConnectFromWebsite } from '../services/run-extension-connect'
import { createCheckoutSession, createPortalSession } from '../services/billing'
import {
  startWebsiteAuthLiveness,
  type WebsiteAuthLivenessStop
} from '../services/auth-session-liveness'
import { clearNavIsProCache, writeNavIsProCacheOnVerified } from '../services/nav-pro-badge-cache'
import { ensureUiBridgeConnected, publishWebsiteAuthChanged } from '../services/ui-bridge'
import { buildLoginHref } from '../services/auth-return'

defineOptions({ name: 'AccountPage' })

/**
 * 账户页范围（仅此四块）：
 * 身份 · 权益（Free/Pro）· 付费与管理 · 结束会话。
 * 扩展 handoff 仍后台执行，不在本页展示。
 */

const user = ref<User | null>(null)
const profileAvatarUrl = ref('')
const profileDisplayName = ref('')
const subscription = ref<UserSubscription | null>(null)
const accessToken = ref<string | null>(null)
/** Worker 对账成功后才为 true；失败时不得把 unknown 当 Free。 */
const subscriptionVerified = ref(false)
const subscriptionLoadError = ref<string | null>(null)
/** 仅挡「未拿到 session」；不因 Dodo 对账堵整页。 */
const pageLoading = ref(true)
/** 订阅区单独转圈（含 Worker→Dodo 对账）。 */
const subscriptionLoading = ref(false)

const isPro = computed(() => isActiveProSnapshot(subscription.value))
const showConfirmedFree = computed(() => subscriptionVerified.value && !isPro.value)
const showVerifyError = computed(
  () => Boolean(subscriptionLoadError.value) && !subscriptionVerified.value && !isPro.value
)

const signInProvider = computed(() => {
  const raw = user.value?.app_metadata?.provider
  if (typeof raw !== 'string' || !raw.trim()) return 'Unknown'
  const p = raw.trim().toLowerCase()
  if (p === 'google') return 'Google'
  if (p === 'azure' || p === 'microsoft') return 'Microsoft'
  if (p === 'email') return 'Email'
  return raw
})

const checkoutBusy = ref(false)
const checkoutError = ref('')
/** Dodo return_url `?checkout=success`：轻提示，不另开 Welcome 页 */
const showCheckoutSuccessHint = ref(false)
let checkoutPollTimer: ReturnType<typeof setTimeout> | null = null

/** 清掉结账回跳参数（含 Dodo 追加的 id/status），避免刷新重复提示 */
function consumeCheckoutReturnParams(): boolean {
  const params = new URLSearchParams(window.location.search)
  const fromCheckout = params.get('checkout') === 'success'
  if (!fromCheckout && !params.has('payment_id') && !params.has('subscription_id')) {
    return false
  }
  const clean = new URL(window.location.href)
  for (const key of [
    'checkout',
    'payment_id',
    'subscription_id',
    'status',
    'email',
    'license_key'
  ]) {
    clean.searchParams.delete(key)
  }
  window.history.replaceState({}, '', clean.pathname + clean.search)
  return fromCheckout
}

function dismissCheckoutSuccessHint(): void {
  showCheckoutSuccessHint.value = false
}

/**
 * 拉订阅（Worker 内强制对账，约数秒）。
 * @param silent 已有快照时后台刷新，不把订阅区打回全量 Loading。
 */
async function loadSubscription(options: { silent?: boolean } = {}): Promise<boolean> {
  if (!accessToken.value) return false
  const silent = Boolean(options.silent && subscription.value)
  if (!silent) {
    subscriptionLoading.value = true
  }
  try {
    const result = await loadUserSubscription(accessToken.value)
    if (result.status === 'ok') {
      subscription.value = result.subscription
      subscriptionVerified.value = true
      subscriptionLoadError.value = null
      writeNavIsProCacheOnVerified(result.isPro)
      return result.isPro
    }
    subscriptionLoadError.value = result.errorCode
    console.warn('[Account] subscription load failed', result.errorCode)
    return isPro.value
  } finally {
    subscriptionLoading.value = false
  }
}

function refreshSubscriptionOnVisible(): void {
  if (document.visibilityState !== 'visible') return
  void loadSubscription({ silent: true })
}

async function startMonthlyCheckout(): Promise<void> {
  if (!accessToken.value) return
  checkoutError.value = ''
  checkoutBusy.value = true
  try {
    const proNow = await loadSubscription({ silent: true })
    if (proNow) {
      console.warn('[Account] 已是有效 Pro，跳过 checkout')
      checkoutError.value = 'This account already has Pro. Manage it from your subscription.'
      return
    }
    const result = await createCheckoutSession(accessToken.value, 'pro_monthly')
    if (result.status === 'already_subscribed') {
      await loadSubscription({ silent: true })
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

let stopAuthLiveness: WebsiteAuthLivenessStop | null = null

onMounted(async () => {
  captureExtensionConnectParamsFromUrl()
  const fromCheckout = consumeCheckoutReturnParams()
  if (fromCheckout) {
    showCheckoutSuccessHint.value = true
  }
  const params = new URLSearchParams(window.location.search)
  const extensionId = params.get('extension_id')?.trim()
  const wantConnect = params.get('connect_extension') === '1'
  // 无 connect 意图：只记退出目标，禁止误 mint
  if (extensionId && !wantConnect) {
    rememberConnectedExtensionId(extensionId)
  }
  // URL 无 connect_extension：清残留 pending，避免误把看账户当成 Connect
  if (!wantConnect) {
    clearExtensionConnectParams()
  }

  const supabase = await getSupabase()
  const { data } = await supabase.auth.getSession()
  if (!data?.session?.user) {
    // Connect 意图但未登录 → 带参去登录页
    if (wantConnect && extensionId) {
      const login = new URLSearchParams()
      login.set('connect_extension', '1')
      login.set('extension_id', extensionId)
      window.location.replace(`/login?${login.toString()}`)
      return
    }
    // 结账回跳丢会话：带回 checkout 标记，登完仍落到账户页
    if (fromCheckout) {
      window.location.replace(buildLoginHref('/account?checkout=success'))
      return
    }
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
  pageLoading.value = false
  document.addEventListener('visibilitychange', refreshSubscriptionOnVisible)
  const becamePro = await loadSubscription()
  // webhook 可能晚几秒：结账回跳后再对账一次
  if (fromCheckout && !becamePro) {
    checkoutPollTimer = setTimeout(() => {
      checkoutPollTimer = null
      void loadSubscription({ silent: true })
    }, 2500)
  }
  // 本浏览器官网会话作废时尽快回登录页（扩展挤掉不踢官网）
  stopAuthLiveness = await startWebsiteAuthLiveness(() => {
    clearNavIsProCache()
    window.location.replace('/login')
  })

  // Connect 回退路径：账户页原地 mint（不进登录壳）；与 UI 桥零导航共用 runExtensionConnect
  if (wantConnect && extensionId) {
    void runExtensionConnectFromWebsite(extensionId, { announceViaBridge: true }).then(status => {
      if (status === 'ok' || status === 'cancelled_displace' || status === 'failed') {
        const clean = new URL(window.location.href)
        clean.searchParams.delete('connect_extension')
        clean.searchParams.delete('extension_id')
        window.history.replaceState({}, '', clean.pathname + clean.search)
      }
    })
  }
})

onUnmounted(() => {
  document.removeEventListener('visibilitychange', refreshSubscriptionOnVisible)
  if (checkoutPollTimer) {
    clearTimeout(checkoutPollTimer)
    checkoutPollTimer = null
  }
  stopAuthLiveness?.()
  stopAuthLiveness = null
})

async function handleSignOut() {
  const supabase = await getSupabase()
  // 只清本浏览器官网会话；不踢本机扩展（与 Connect 显式接通对称）
  await supabase.auth.signOut({ scope: 'local' })
  clearNavIsProCache()
  // UI 桥：扩展 Connect 条可消失；扩展登录态仍由扩展自己管
  try {
    await ensureUiBridgeConnected()
    publishWebsiteAuthChanged({ signedIn: false })
  } catch (error) {
    console.warn('[AccountPage] ui-bridge auth publish failed', error)
  }
  window.location.href = '/login'
}
</script>

<template>
  <div v-if="!pageLoading && user" class="account page">
    <p
      v-if="showCheckoutSuccessHint"
      class="account__checkout-hint"
      role="status"
      aria-live="polite"
    >
      <span>
        Payment received. Pro usually shows within a few seconds — refresh if the plan below still
        says Free.
      </span>
      <button
        type="button"
        class="account__checkout-hint-dismiss"
        @click="dismissCheckoutSuccessHint"
      >
        Dismiss
      </button>
    </p>

    <!-- 1. 身份 -->
    <header class="account__identity">
      <div class="account__who">
        <img
          v-if="profileAvatarUrl"
          class="account__avatar"
          :src="profileAvatarUrl"
          alt=""
          width="56"
          height="56"
          decoding="async"
        />
        <!-- 无 OAuth 头像：品牌标，禁止邮箱首字符（数字/符号无意义） -->
        <img
          v-else
          class="account__avatar account__avatar--brand"
          src="/images/logo-mark.svg"
          alt=""
          width="56"
          height="56"
          decoding="async"
        />
        <div class="account__who-text">
          <h1 class="account__name">{{ profileDisplayName || user.email }}</h1>
          <p class="account__meta">
            <span class="account__meta-email">{{ user.email }}</span>
            <span class="account__dot" aria-hidden="true">·</span>
            <span class="account__meta-provider">{{ signInProvider }}</span>
          </p>
        </div>
      </div>
      <!-- 4. 结束会话 -->
      <button type="button" class="account__sign-out" @click="handleSignOut">Sign out</button>
    </header>

    <!-- 2. 权益 + 3. 付费与管理 -->
    <section class="account__plan" aria-labelledby="account-plan-heading">
      <h2 id="account-plan-heading" class="account__section-label">Plan</h2>

      <div
        v-if="subscriptionLoading && !subscription"
        class="account__plan-panel account__plan-panel--loading"
        role="status"
        aria-live="polite"
      >
        <div class="account__skel account__skel--title" />
        <div class="account__skel account__skel--line" />
        <div class="account__skel account__skel--line account__skel--short" />
        <p class="account__plan-status-text">Checking your plan…</p>
      </div>

      <div v-else class="account__plan-panel" :class="{ 'account__plan-panel--pro': isPro }">
        <div class="account__plan-top">
          <p class="account__plan-name">
            {{ isPro ? 'Pro' : showVerifyError ? "Couldn't load plan" : 'Free' }}
          </p>
          <p v-if="subscriptionLoading" class="account__plan-updating" role="status">Updating…</p>
        </div>
        <p v-if="showVerifyError" class="account__plan-renew" role="alert">
          We couldn’t verify your plan right now. Your paid access is unchanged if you already
          subscribe.
        </p>
        <p v-else-if="isPro && subscription?.status" class="account__plan-renew">
          <span class="account__plan-status">{{ subscription.status }}</span>
          <template v-if="subscription.currentPeriodEnd">
            · Renews / ends {{ formatDate(subscription.currentPeriodEnd) }}
          </template>
        </p>
        <div class="account__plan-actions">
          <button
            v-if="showVerifyError"
            type="button"
            class="ui-btn ui-btn--primary"
            :disabled="subscriptionLoading"
            @click="loadSubscription()"
          >
            Retry
          </button>
          <button
            v-if="showConfirmedFree"
            type="button"
            class="ui-btn ui-btn--primary"
            :disabled="checkoutBusy || subscriptionLoading"
            @click="startMonthlyCheckout"
          >
            {{ checkoutBusy ? 'Opening…' : 'Upgrade to Pro' }}
          </button>
          <button
            v-if="isPro"
            type="button"
            class="ui-btn"
            :disabled="subscriptionLoading"
            @click="openPortal"
          >
            Manage subscription
          </button>
          <a class="ui-btn ui-btn--ghost" href="/pricing">View pricing</a>
        </div>
        <p v-if="checkoutError" class="account__error" role="alert">{{ checkoutError }}</p>
      </div>
    </section>
  </div>
  <div v-else class="ui-status">Loading…</div>
</template>

<style scoped>
.account {
  max-width: 720px;
}

.account__checkout-hint {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px 16px;
  margin: 0 0 clamp(20px, 3vw, 28px);
  padding: 12px 14px;
  border: 1px solid color-mix(in srgb, var(--sage) 28%, var(--border));
  border-radius: 10px;
  background: color-mix(in srgb, var(--sage) 8%, var(--paper, #fff));
  font-size: 14px;
  font-weight: 400;
  line-height: 1.45;
  color: var(--charcoal, var(--ink));
}

.account__checkout-hint-dismiss {
  flex-shrink: 0;
  margin: 0;
  padding: 2px 6px;
  border: none;
  border-radius: 6px;
  background: transparent;
  font: inherit;
  font-size: 13px;
  color: var(--muted);
  cursor: pointer;
}

.account__checkout-hint-dismiss:hover {
  background: color-mix(in srgb, var(--paper-dim) 80%, transparent);
  color: var(--charcoal, var(--ink));
}

.account__checkout-hint-dismiss:focus-visible {
  outline: 2px solid var(--focus-ring, color-mix(in srgb, var(--sage) 45%, transparent));
  outline-offset: 2px;
}

.account__identity {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: clamp(28px, 4vw, 40px);
  padding-bottom: clamp(24px, 3vw, 32px);
  border-bottom: 1px solid var(--border);
}

.account__who {
  display: flex;
  align-items: center;
  flex: 1;
  gap: 14px;
  min-width: 0;
}

.account__avatar {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
  background: var(--paper-dim);
}

.account__avatar--brand {
  box-sizing: border-box;
  padding: 10px;
  object-fit: contain;
  background: var(--paper-dim);
  border: 1px solid var(--border);
}

.account__who-text {
  min-width: 0;
}

.account__name {
  margin: 0;
  font-family: var(--font-display);
  font-weight: 400;
  font-size: clamp(24px, 3.2vw, 30px);
  letter-spacing: -0.025em;
  line-height: 1.15;
  color: var(--ink);
}

.account__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 0.35em;
  margin: 6px 0 0;
  font-size: 14px;
  font-weight: 300;
  line-height: 1.4;
  color: var(--sage-muted);
}

.account__meta-email {
  min-width: 0;

  /* 仅邮箱可断；勿用 anywhere，避免把 Google 拆成 Googl / e */
  overflow-wrap: break-word;
}

.account__meta-provider {
  flex-shrink: 0;
  white-space: nowrap;
}

.account__dot {
  flex-shrink: 0;
  opacity: 0.7;
}

.account__sign-out {
  flex-shrink: 0;
  margin-top: 4px;
  padding: 8px 10px;
  border: none;
  border-radius: 8px;
  background: transparent;
  font: inherit;
  font-size: 13px;
  font-weight: 400;
  color: var(--muted);
  cursor: pointer;
}

.account__sign-out:hover {
  background: color-mix(in srgb, var(--paper-dim) 80%, transparent);
  color: var(--charcoal);
}

.account__sign-out:focus-visible {
  outline: 2px solid var(--focus-ring, color-mix(in srgb, var(--sage) 45%, transparent));
  outline-offset: 2px;
}

.account__section-label {
  margin: 0 0 12px;
  font-family: var(--font-body, 'Work Sans', system-ui, sans-serif);
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--sage-muted);
}

.account__plan {
  margin-bottom: 0;
}

.account__plan-panel {
  padding: clamp(20px, 3vw, 28px);
  border: 1px solid var(--border);
  border-radius: 12px;
  background: color-mix(in srgb, var(--paper) 72%, white);
}

.account__plan-panel--pro {
  border-color: color-mix(in srgb, var(--sage) 28%, var(--border));
  background: color-mix(in srgb, var(--sage) 8%, var(--paper));
}

.account__plan-panel--loading {
  min-height: 120px;
}

.account__plan-top {
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
}

.account__plan-name {
  margin: 0;
  font-family: var(--font-display);
  font-weight: 400;
  font-size: clamp(26px, 3.5vw, 32px);
  letter-spacing: -0.03em;
  line-height: 1.1;
  color: var(--ink);
}

.account__plan-updating {
  margin: 0;
  font-size: 13px;
  font-weight: 300;
  color: var(--sage-muted);
}

.account__plan-renew {
  margin: 8px 0 0;
  font-size: 14px;
  font-weight: 300;
  color: var(--muted);
}

.account__plan-status {
  text-transform: capitalize;
}

.account__plan-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 20px;
}

.account__plan-status-text {
  margin: 14px 0 0;
  font-size: 13px;
  font-weight: 300;
  color: var(--sage-muted);
}

.account__error {
  margin: 12px 0 0;
  font-size: 13px;
  color: var(--danger);
}

.account__skel {
  height: 12px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--border) 70%, var(--paper));
  opacity: 0.85;
  animation: account-skel 1.2s ease-in-out infinite;
}

.account__skel--title {
  width: 28%;
  height: 28px;
  margin-bottom: 14px;
}

.account__skel--line {
  width: 88%;
  margin-bottom: 8px;
}

.account__skel--short {
  width: 54%;
}

@keyframes account-skel {
  0%,
  100% {
    opacity: 0.55;
  }

  50% {
    opacity: 0.95;
  }
}

@media (prefers-reduced-motion: reduce) {
  .account__skel {
    animation: none;
  }
}

/* 窄于 md：身份区纵向（官网断点闭集 · 640） */
@media (width < 640px) {
  .account__identity {
    flex-direction: column;
    align-items: stretch;
  }

  .account__sign-out {
    align-self: flex-start;
    margin-top: 0;
    padding-left: 0;
  }
}
</style>
