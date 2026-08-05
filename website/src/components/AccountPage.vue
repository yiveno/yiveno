<script setup lang="ts">
import type { User } from '@supabase/supabase-js'
import { computed, onMounted, ref } from 'vue'
import { getSupabase } from '../services/supabase'
import { getUserSubscription, type UserSubscription } from '../services/subscription'
import { formatDate } from '../services/date'
import {
  handoffSignOutToExtension,
  rememberConnectedExtensionId,
  extractProfileFromUserMetadata
} from '../services/extension-auth-handoff'
import { buildGumroadUpgradeUrl, getGumroadManageUrl } from '../services/gumroad-urls'

defineOptions({ name: 'AccountPage' })

const user = ref<User | null>(null)
const profileAvatarUrl = ref('')
const profileDisplayName = ref('')
const subscription = ref<UserSubscription | null>(null)
const accessToken = ref<string | null>(null)
const loading = ref(true)

const isPro = computed(
  () => subscription.value?.tier === 'pro' && subscription.value?.status === 'active'
)

const upgradeUrl = computed(() => {
  const id = user.value?.id
  return id ? buildGumroadUpgradeUrl(id) : null
})

const manageUrl = getGumroadManageUrl()

onMounted(async () => {
  // 扩展打开账户页会带 extension_id，记住以便退出回传
  const params = new URLSearchParams(window.location.search)
  const extensionId = params.get('extension_id')?.trim()
  if (extensionId) {
    rememberConnectedExtensionId(extensionId)
  }

  const supabase = await getSupabase()
  const { data } = await supabase.auth.getSession()
  if (!data?.session?.user) {
    // 未登录访问账户页：直接进登录，不展示「请先登录」中间态
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
  const sub = await getUserSubscription(data.session.access_token)
  if (sub) subscription.value = sub
  loading.value = false
})

async function handleRefreshSubscription() {
  if (!accessToken.value) return
  const sub = await getUserSubscription(accessToken.value)
  subscription.value = sub
}

async function handleSignOut() {
  const supabase = await getSupabase()
  await supabase.auth.signOut()
  // 通知扩展清登录态（keep_local）；失败不阻塞官网退出
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
          Pro unlocks Hybrid recall, cloud sync, and hosted clue understanding. Free keeps keyword
          Filter on this device.
        </p>
        <div class="actions">
          <a
            v-if="!isPro && upgradeUrl"
            class="btn btn-primary"
            :href="upgradeUrl"
            target="_blank"
            rel="noopener noreferrer"
          >
            Upgrade to Pro
          </a>
          <a v-if="isPro" class="btn" :href="manageUrl" target="_blank" rel="noopener noreferrer">
            Manage subscription
          </a>
          <button type="button" class="btn btn-ghost" @click="handleRefreshSubscription">
            Refresh status
          </button>
        </div>
        <p v-if="!isPro && !upgradeUrl" class="hint">
          Upgrade link is not configured (missing PUBLIC_GUMROAD_PRODUCT_URL).
        </p>
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

.btn-primary {
  background: #111;
  color: #fff;
  border-color: #111;
}

.btn-ghost {
  background: transparent;
}

.sign-out-hint {
  margin-top: 0.75rem;
  color: #777;
  font-size: 0.85rem;
}

.loading {
  text-align: center;
  padding: 3rem;
  color: #666;
}
</style>
