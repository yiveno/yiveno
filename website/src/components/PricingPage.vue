<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { getPaidTiers, type Tier } from '../billing/tiers'
import { buildLoginHref } from '../services/auth-return'
import { getPaddle, previewFormattedTotals, resolveWelcomeUrl } from '../services/paddle'
import { createPortalSession } from '../services/billing'
import { getSupabase } from '../services/supabase'
import { getUserSubscription } from '../services/subscription'

defineOptions({ name: 'PricingPage' })

const props = defineProps<{
  /** 服务端解析的 ISO 国家码；缺省时不传给 Paddle */
  countryCode?: string
}>()

type BillingCycle = 'month' | 'year'

const proTier = ref<Tier | null>(null)
const cycle = ref<BillingCycle>('month')
const pricesLoading = ref(true)
const pricesError = ref('')
const checkoutBusy = ref(false)
const checkoutError = ref('')
const portalBusy = ref(false)
/** priceId → Paddle formattedTotals.total */
const formattedByPriceId = ref<Map<string, string>>(new Map())
const customerEmail = ref<string | null>(null)
const customerUserId = ref<string | null>(null)
const accessToken = ref<string | null>(null)
const isPro = ref(false)

const intervalLabel = computed(() => (cycle.value === 'month' ? '/mo' : '/yr'))

function proPriceId(): string | null {
  return proTier.value ? proTier.value.priceId[cycle.value] : null
}

function proDisplayTotal(): string {
  const id = proPriceId()
  if (!id) return '—'
  return formattedByPriceId.value.get(id) || '—'
}

async function loadPrices(): Promise<void> {
  pricesError.value = ''
  pricesLoading.value = true
  try {
    if (!proTier.value) {
      proTier.value = getPaidTiers()[0] ?? null
    }
    const tier = proTier.value
    if (!tier) {
      throw new Error('Pro tier is not configured')
    }
    const map = await previewFormattedTotals({
      priceIds: [tier.priceId.month, tier.priceId.year],
      ...(props.countryCode ? { countryCode: props.countryCode } : {})
    })
    formattedByPriceId.value = map
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    console.error('[Pricing] PricePreview failed', detail)
    pricesError.value = 'Could not load localized prices. Refresh and try again.'
  } finally {
    pricesLoading.value = false
  }
}

/**
 * 未登录不得开 overlay：否则缺 yiveno_user_id → 孤立付款。
 * 已登录则始终带 customData，供 webhook 授 Pro。
 */
async function subscribePro(): Promise<void> {
  if (!customerUserId.value) {
    console.warn('[Pricing] Subscribe 需先登录，跳转 /login')
    window.location.assign(buildLoginHref('/pricing', 'subscribe'))
    return
  }

  const tier = proTier.value
  const priceId = proPriceId()
  if (!tier || !priceId) return

  checkoutError.value = ''
  checkoutBusy.value = true
  try {
    const paddle = await getPaddle()
    console.warn('[Pricing] Checkout.open', { priceId, userId: customerUserId.value })
    paddle.Checkout.open({
      items: [{ priceId, quantity: 1 }],
      ...(customerEmail.value ? { customer: { email: customerEmail.value } } : {}),
      customData: { yiveno_user_id: customerUserId.value },
      settings: {
        displayMode: 'overlay',
        variant: 'one-page',
        successUrl: resolveWelcomeUrl()
      }
    })
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    console.error('[Pricing] Checkout.open failed', detail)
    checkoutError.value = 'Could not open checkout. Try again.'
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
    customerEmail.value = data.session?.user.email ?? null
    customerUserId.value = data.session?.user.id ?? null
    accessToken.value = data.session?.access_token ?? null
    if (data.session?.access_token) {
      const sub = await getUserSubscription(data.session.access_token)
      isPro.value = sub?.tier === 'pro' && sub.status === 'active'
    }
  } catch (err) {
    console.warn('[Pricing] session load skipped', err)
  }
  await loadPrices()
  await resumeSubscribeIntentIfNeeded()
})

watch(
  () => props.countryCode,
  () => {
    void loadPrices()
  }
)
</script>

<template>
  <div class="pricing-page">
    <header class="hero">
      <h1>Pricing</h1>
      <p class="lede">
        Your memory hard drive: save lightly, recall with confidence. Free and Pro share the same
        on-device recall quality; Pro keeps your library across devices and gives a larger hosted
        clue-understanding quota.
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

    <p v-if="pricesError" class="banner error" role="alert">{{ pricesError }}</p>
    <p v-if="checkoutError" class="banner error" role="alert">{{ checkoutError }}</p>

    <div class="plans">
      <section class="plan" aria-labelledby="plan-free">
        <h2 id="plan-free">Free</h2>
        <p class="price">$0</p>
        <p class="desc">Full on-device recall. No cloud sync.</p>
        <ul>
          <li>Capture excerpts &amp; bookmarks</li>
          <li>On-device Hybrid recall (keyword + embedding)</li>
          <li>Local library, notes, export</li>
          <li>Sign in: small hosted clue LLM quota</li>
        </ul>
        <div class="cta">
          <a class="btn" href="/login">Sign in</a>
        </div>
      </section>

      <section class="plan plan-highlight" aria-labelledby="plan-pro">
        <h2 id="plan-pro">Pro</h2>
        <p class="price">
          <span v-if="pricesLoading">…</span>
          <template v-else>
            {{ proDisplayTotal() }}<span class="interval">{{ intervalLabel }}</span>
          </template>
        </p>
        <p class="desc">{{ proTier?.description }}</p>
        <ul>
          <li v-for="feature in proTier?.features || []" :key="feature">{{ feature }}</li>
        </ul>
        <div class="cta">
          <button v-if="isPro" class="btn" type="button" :disabled="portalBusy" @click="openPortal">
            {{ portalBusy ? 'Opening…' : 'Manage subscription' }}
          </button>
          <button
            v-else
            class="btn btn-primary"
            type="button"
            :disabled="pricesLoading || checkoutBusy"
            @click="subscribePro"
          >
            {{ checkoutBusy ? 'Opening…' : customerUserId ? 'Subscribe' : 'Sign in to subscribe' }}
          </button>
        </div>
      </section>
    </div>

    <p class="footnote">
      Roadmap only (not for sale): Power User, Team. Localized Pro totals come from Paddle Price
      Preview — we never reformat them. Checkout opens as a Paddle overlay.
    </p>
  </div>
</template>

<style scoped>
.pricing-page {
  max-width: 880px;
  margin: 0 auto;
  padding: 3rem 1.25rem 4rem;
}

.hero {
  text-align: center;
  margin-bottom: 2rem;
}

h1 {
  font-size: 2.25rem;
  margin: 0 0 0.75rem;
}

.lede {
  margin: 0 auto 1.5rem;
  max-width: 36rem;
  color: #444;
  line-height: 1.6;
}

.billing-toggle {
  display: inline-flex;
  border: 1px solid #ddd;
  border-radius: 10px;
  overflow: hidden;
  background: #f7f7f7;
}

.toggle-btn {
  appearance: none;
  border: 0;
  background: transparent;
  padding: 0.55rem 1.1rem;
  font: inherit;
  cursor: pointer;
  color: #444;
}

.toggle-btn.active {
  background: #111;
  color: #fff;
}

.banner {
  text-align: center;
  margin: 0 0 1rem;
  font-size: 0.9rem;
}

.banner.error {
  color: #a33;
}

.plans {
  display: grid;
  gap: 1.25rem;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
}

.plan {
  border: 1px solid #e6e6e6;
  border-radius: 12px;
  padding: 1.5rem;
  background: #fff;
  display: flex;
  flex-direction: column;
}

.plan-highlight {
  border-color: #111;
}

h2 {
  margin: 0 0 0.5rem;
  font-size: 1.25rem;
}

.price {
  font-size: 1.75rem;
  margin: 0 0 0.5rem;
  font-weight: 600;
}

.interval {
  font-size: 0.95rem;
  font-weight: 400;
  color: #666;
  margin-left: 0.15rem;
}

.desc {
  margin: 0 0 1rem;
  color: #555;
  line-height: 1.5;
  font-size: 0.95rem;
}

ul {
  margin: 0;
  padding-left: 1.1rem;
  line-height: 1.7;
  color: #333;
  flex: 1;
}

.cta {
  margin-top: 1.25rem;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 0.7rem 1.1rem;
  border-radius: 8px;
  border: 1px solid #ddd;
  background: #f7f7f7;
  color: inherit;
  cursor: pointer;
  font: inherit;
  text-decoration: none;
  box-sizing: border-box;
}

.btn-primary {
  background: #111;
  color: #fff;
  border-color: #111;
}

.btn:disabled {
  opacity: 0.6;
  cursor: default;
}

.footnote {
  margin-top: 2rem;
  text-align: center;
  color: #777;
  font-size: 0.9rem;
  line-height: 1.5;
}
</style>
