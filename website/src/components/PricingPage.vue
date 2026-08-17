<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { getPaidTiers, type Tier } from '../billing/tiers'
import { buildLoginHref } from '../services/auth-return'
import { createCheckoutSession, createPortalSession } from '../services/billing'
import { getSupabase } from '../services/supabase'
import { getUserSubscription, isActiveProSnapshot } from '../services/subscription'

defineOptions({ name: 'PricingPage' })

type BillingCycle = 'month' | 'year'

const proTier = ref<Tier | null>(getPaidTiers()[0] ?? null)
const cycle = ref<BillingCycle>('month')
const checkoutBusy = ref(false)
const checkoutError = ref('')
const portalBusy = ref(false)
const customerUserId = ref<string | null>(null)
const accessToken = ref<string | null>(null)
const isPro = ref(false)

const intervalLabel = computed(() => (cycle.value === 'month' ? '/mo' : '/yr'))

function proDisplayTotal(): string {
  const usd = proTier.value?.displayUsd[cycle.value]
  return usd ? `$${usd}` : '—'
}

function currentPlanId(): 'pro_monthly' | 'pro_annual' | null {
  return proTier.value ? proTier.value.planId[cycle.value] : null
}

/** 对账后刷新 isPro；失败时保持原值。 */
async function refreshProFlag(): Promise<boolean> {
  if (!accessToken.value) return false
  const sub = await getUserSubscription(accessToken.value)
  isPro.value = isActiveProSnapshot(sub)
  return isPro.value
}

/**
 * 未登录不得开 checkout：否则缺 yiveno_user_id → 孤立付款。
 * 已登录先对账：有效 Pro 改走 Portal，不再跳 Dodo checkout。
 */
async function subscribePro(): Promise<void> {
  if (!customerUserId.value || !accessToken.value) {
    console.warn('[Pricing] Subscribe 需先登录，跳转 /login')
    window.location.assign(buildLoginHref('/pricing', 'subscribe'))
    return
  }

  const plan = currentPlanId()
  if (!plan) return

  checkoutError.value = ''
  checkoutBusy.value = true
  try {
    const alreadyPro = await refreshProFlag()
    if (alreadyPro) {
      console.warn('[Pricing] 已是有效 Pro，跳过 checkout')
      checkoutError.value = 'This account already has Pro. Manage it from your subscription.'
      return
    }

    const result = await createCheckoutSession(accessToken.value, plan)
    if (result.status === 'already_subscribed') {
      isPro.value = true
      console.warn('[Pricing] Worker 判定已是 Pro，拒绝新 checkout')
      checkoutError.value = 'This account already has Pro. Manage it from your subscription.'
      return
    }
    if (result.status !== 'ok') {
      checkoutError.value = 'Could not start checkout. Try again.'
      return
    }
    window.location.assign(result.checkoutUrl)
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    console.error('[Pricing] checkout-session failed', detail)
    checkoutError.value = 'Could not start checkout. Try again.'
  } finally {
    checkoutBusy.value = false
  }
}

/** 登录回跳带 intent=subscribe 时自动续开 checkout，并清掉 query 避免刷新重复弹 */
async function resumeSubscribeIntentIfNeeded(): Promise<void> {
  const params = new URLSearchParams(window.location.search)
  if (params.get('intent') !== 'subscribe') return
  params.delete('intent')
  const clean = `${window.location.pathname}${params.toString() ? `?${params}` : ''}${window.location.hash}`
  window.history.replaceState({}, '', clean)

  if (!customerUserId.value) {
    console.warn('[Pricing] intent=subscribe 但无 session，再送登录')
    window.location.assign(buildLoginHref('/pricing', 'subscribe'))
    return
  }
  if (isPro.value) {
    console.warn('[Pricing] 已是 Pro，跳过自动 checkout')
    return
  }
  console.warn('[Pricing] 登录回跳，自动打开 checkout')
  await subscribePro()
}

async function openPortal(): Promise<void> {
  if (!accessToken.value) return
  portalBusy.value = true
  const url = await createPortalSession(accessToken.value)
  portalBusy.value = false
  if (url) window.location.assign(url)
}

onMounted(async () => {
  try {
    const supabase = await getSupabase()
    const { data } = await supabase.auth.getSession()
    customerUserId.value = data.session?.user.id ?? null
    accessToken.value = data.session?.access_token ?? null
    if (data.session?.access_token) {
      const sub = await getUserSubscription(data.session.access_token)
      isPro.value = isActiveProSnapshot(sub)
    }
  } catch (err) {
    console.warn('[Pricing] session load skipped', err)
  }
  await resumeSubscribeIntentIfNeeded()
})
</script>

<template>
  <div class="pricing-page page page--wide">
    <header class="pricing-page__hero">
      <h1 class="page__title">Pricing</h1>
      <p class="page__lede">
        Find what you saved: capture lightly, get a short list of closest matches — you pick. Free
        and Pro share the same on-device recall quality; Pro keeps your library across devices and
        gives a larger hosted clue-understanding quota.
      </p>

      <div class="billing-toggle" role="group" aria-label="Pro billing period">
        <button
          type="button"
          class="toggle-btn"
          :class="{ active: cycle === 'month' }"
          @click="cycle = 'month'"
        >
          Monthly
        </button>
        <button
          type="button"
          class="toggle-btn"
          :class="{ active: cycle === 'year' }"
          @click="cycle = 'year'"
        >
          Yearly
        </button>
      </div>
    </header>

    <p v-if="checkoutError" class="ui-banner" role="alert">{{ checkoutError }}</p>

    <div class="plans">
      <section class="plan" aria-labelledby="plan-free">
        <p class="plan__tier" id="plan-free">Free</p>
        <p class="plan__price">$0</p>
        <p class="plan__desc">Full on-device recall. No cloud sync.</p>
        <ul class="plan__features">
          <li>Capture excerpts &amp; bookmarks</li>
          <li>On-device closest matches</li>
          <li>Local library, notes, export</li>
          <li>Sign in: small hosted clue quota</li>
        </ul>
        <div class="plan__cta">
          <a class="ui-btn ui-btn--block" href="/login">Sign in</a>
        </div>
      </section>

      <section class="plan plan--pro" aria-labelledby="plan-pro">
        <p class="plan__tier" id="plan-pro">Pro</p>
        <p class="plan__price">
          {{ proDisplayTotal() }}<span class="plan__interval">{{ intervalLabel }}</span>
        </p>
        <p class="plan__desc">{{ proTier?.description }}</p>
        <ul class="plan__features">
          <li v-for="feature in proTier?.features || []" :key="feature">{{ feature }}</li>
        </ul>
        <div class="plan__cta">
          <button
            v-if="isPro"
            class="ui-btn ui-btn--block"
            type="button"
            :disabled="portalBusy"
            @click="openPortal"
          >
            {{ portalBusy ? 'Opening…' : 'Manage subscription' }}
          </button>
          <button
            v-else
            class="ui-btn ui-btn--primary ui-btn--block"
            type="button"
            :disabled="checkoutBusy"
            @click="subscribePro"
          >
            {{ checkoutBusy ? 'Opening…' : customerUserId ? 'Subscribe' : 'Sign in to subscribe' }}
          </button>
        </div>
      </section>
    </div>

    <p class="pricing-page__footnote">
      Roadmap only (not for sale): Power User, Team. Displayed totals are list prices before tax.
      Checkout happens on Dodo hosted checkout after you sign in.
    </p>
  </div>
</template>

<style scoped>
.pricing-page__hero {
  text-align: center;
  margin-bottom: clamp(32px, 5vw, 48px);
}

.pricing-page__hero .page__lede {
  margin-left: auto;
  margin-right: auto;
  max-width: 36rem;
}

.billing-toggle {
  display: inline-flex;
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
  background: var(--paper-dim);
}

.toggle-btn {
  appearance: none;
  border: 0;
  background: transparent;
  padding: 0.55rem 1.1rem;
  font: inherit;
  font-size: 13.5px;
  cursor: pointer;
  color: var(--muted);
  transition:
    background 0.15s,
    color 0.15s;
}

.toggle-btn.active {
  background: var(--sage);
  color: var(--sage-on);
}

.plans {
  display: grid;
  gap: clamp(16px, 2.5vw, 28px);
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
}

.plan {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: clamp(24px, 3vw, 36px);
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--paper-dim);
  text-align: left;
}

.plan--pro {
  background: var(--sage);
  border-color: var(--sage);
  color: #dce8de;
}

.plan__tier {
  margin: 0 0 16px;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--sage-muted);
}

.plan--pro .plan__tier {
  color: rgba(196, 224, 210, 0.7);
}

.plan__price {
  margin: 0 0 10px;
  font-family: var(--font-display);
  font-weight: 400;
  font-size: clamp(30px, 3.5vw, 40px);
  letter-spacing: -0.03em;
  color: var(--ink);
}

.plan--pro .plan__price {
  color: #dce8de;
}

.plan__interval {
  font-family: var(--font-body);
  font-size: 13px;
  font-weight: 300;
  color: var(--muted);
  margin-left: 0.2rem;
}

.plan--pro .plan__interval {
  color: rgba(196, 224, 210, 0.65);
}

.plan__desc {
  margin: 0 0 28px;
  font-size: 14px;
  font-weight: 300;
  line-height: 1.55;
  color: var(--muted);
}

.plan--pro .plan__desc {
  color: rgba(196, 224, 210, 0.75);
}

.plan__features {
  margin: 0 0 28px;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
}

.plan__features li {
  font-size: 13.5px;
  font-weight: 300;
  line-height: 1.5;
  color: var(--muted);
  padding-left: 0;
}

.plan--pro .plan__features li {
  color: rgba(196, 224, 210, 0.85);
}

.plan__cta {
  margin-top: auto;
}

.plan--pro :deep(.ui-btn:not(.ui-btn--primary)) {
  border-color: rgba(220, 232, 222, 0.25);
  background: rgba(220, 232, 222, 0.09);
  color: rgba(220, 232, 222, 0.9);
}

.plan--pro :deep(.ui-btn:not(.ui-btn--primary):hover),
.plan--pro :deep(.ui-btn:not(.ui-btn--primary):focus-visible) {
  background: rgba(220, 232, 222, 0.15);
}

.plan--pro :deep(.ui-btn--primary) {
  background: rgba(220, 232, 222, 0.14);
  border-color: rgba(220, 232, 222, 0.3);
  color: #dce8de;
}

.plan--pro :deep(.ui-btn--primary):hover,
.plan--pro :deep(.ui-btn--primary):focus-visible {
  background: rgba(220, 232, 222, 0.22);
}

.pricing-page__footnote {
  margin-top: clamp(28px, 4vw, 40px);
  text-align: center;
  color: var(--sage-muted);
  font-size: 13px;
  font-weight: 300;
  line-height: 1.55;
}
</style>
