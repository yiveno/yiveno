<script setup lang="ts">
import type { User } from '@supabase/supabase-js'
import { computed, onMounted, ref } from 'vue'
import { getSupabase } from '../services/supabase'
import { buildGumroadUpgradeUrl, getGumroadManageUrl } from '../services/gumroad-urls'
import { getUserSubscription } from '../services/subscription'

defineOptions({ name: 'PricingPage' })

const user = ref<User | null>(null)
const isPro = ref(false)
const loading = ref(true)

const upgradeUrl = computed(() => {
  const id = user.value?.id
  return id ? buildGumroadUpgradeUrl(id) : null
})

const manageUrl = getGumroadManageUrl()

onMounted(async () => {
  const supabase = await getSupabase()
  const { data } = await supabase.auth.getSession()
  if (data?.session?.user) {
    user.value = data.session.user
    const sub = await getUserSubscription(data.session.access_token)
    isPro.value = sub?.tier === 'pro' && sub.status === 'active'
  }
  loading.value = false
})
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
    </header>

    <div class="plans">
      <section class="plan" aria-labelledby="plan-free">
        <h2 id="plan-free">Free</h2>
        <p class="price">$0</p>
        <ul>
          <li>Capture excerpts &amp; bookmarks</li>
          <li>On-device Hybrid recall (keyword + embedding)</li>
          <li>Local library, notes, export</li>
          <li>Sign in: small hosted clue LLM quota (no cloud sync)</li>
        </ul>
      </section>

      <section class="plan plan-pro" aria-labelledby="plan-pro">
        <h2 id="plan-pro">Pro</h2>
        <p class="price">$5.99<span>/mo</span> · $59<span>/yr</span></p>
        <p class="price-note">
          Display price (USD). Gumroad checkout is the source of truth—change price there, not in
          app billing code.
        </p>
        <ul>
          <li>Same on-device recall quality as Free</li>
          <li>Cloud sync across devices</li>
          <li>Larger hosted clue understanding quota</li>
          <li>Higher embedding daily cap; sync does not upload embeddings</li>
        </ul>

        <div v-if="!loading" class="cta">
          <a v-if="isPro" class="btn" :href="manageUrl" target="_blank" rel="noopener noreferrer">
            Manage subscription
          </a>
          <a
            v-else-if="user && upgradeUrl"
            class="btn btn-primary"
            :href="upgradeUrl"
            target="_blank"
            rel="noopener noreferrer"
          >
            Upgrade to Pro
          </a>
          <a v-else-if="user && !upgradeUrl" class="btn btn-primary" href="/account">
            Open account
          </a>
          <a v-else class="btn btn-primary" href="/login"> Sign in to upgrade </a>
        </div>
      </section>
    </div>

    <p class="footnote">
      Roadmap only (not for sale): Power User, Team. We do not sell a Premium tier today. Sharing
      and multimodal capture are not listed until shipped.
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
  margin-bottom: 2.5rem;
}

h1 {
  font-size: 2.25rem;
  margin: 0 0 0.75rem;
}

.lede {
  margin: 0 auto;
  max-width: 36rem;
  color: #444;
  line-height: 1.6;
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
}

.plan-pro {
  border-color: #111;
}

h2 {
  margin: 0 0 0.5rem;
  font-size: 1.25rem;
}

.price {
  font-size: 1.75rem;
  margin: 0 0 0.35rem;
  font-weight: 600;
}

.price span {
  font-size: 0.95rem;
  font-weight: 400;
  color: #666;
}

.price-note {
  margin: 0 0 1rem;
  color: #777;
  font-size: 0.85rem;
}

ul {
  margin: 0;
  padding-left: 1.1rem;
  line-height: 1.7;
  color: #333;
}

.cta {
  margin-top: 1.25rem;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.65rem 1.1rem;
  border-radius: 8px;
  border: 1px solid #ddd;
  text-decoration: none;
  color: inherit;
  background: #f7f7f7;
}

.btn-primary {
  background: #111;
  color: #fff;
  border-color: #111;
}

.footnote {
  margin-top: 2rem;
  text-align: center;
  color: #777;
  font-size: 0.9rem;
  line-height: 1.5;
}
</style>
