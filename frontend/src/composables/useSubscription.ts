import { ref, computed, watchEffect } from 'vue'
import { subscriptionAppService } from '@/application/subscription/subscription-app-service'
import { useSupabaseAuth } from './useSupabaseAuth'
import { chromeStorage } from '@/infrastructure/storage/chrome-storage'
import type { Subscription, UserSubscriptionStatus } from '@/infrastructure/supabase/types'
import type { GumroadBillingFrequency } from '@/infrastructure/gumroad/client'

const CACHE_KEY = 'ottersage_subscription_cache'
const CACHE_DURATION = 15 * 60 * 1000

interface SubscriptionCache {
  subscription: Subscription | null
  subscriptionStatus: UserSubscriptionStatus | null
  timestamp: number
  userId: string
}

/** 模块级单例，所有 useSubscription() 调用共享 */
const subscription = ref<Subscription | null>(null)
const subscriptionStatus = ref<UserSubscriptionStatus | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const isInitialized = ref(false)

// 去重锁：同一页面多个组件同时调用时只发一次请求
let inflightLoad: Promise<void> | null = null
let inflightLoadUserId: string | null = null
let watchAttached = false
let lastUserId: string | null = null

const isPro = computed(
  () => subscriptionStatus.value?.tier === 'pro' && subscriptionStatus.value?.status === 'active'
)

const isExpiringSoon = computed(() => {
  const end = subscriptionStatus.value?.current_period_end
  if (!end) return false
  return (new Date(end).getTime() - Date.now()) / 86400000 <= 7
})

const isCancelledButActive = computed(
  () =>
    subscriptionStatus.value?.cancel_at_period_end === true &&
    subscriptionStatus.value?.status === 'active'
)

async function loadSubscription(forceRefresh = false) {
  const { user, isAuthenticated } = useSupabaseAuth()
  const uid = user.value?.id

  if (!isAuthenticated.value || !uid) {
    subscription.value = null
    subscriptionStatus.value = null
    isInitialized.value = true
    return
  }

  const cached = await chromeStorage.getLocal<SubscriptionCache>(CACHE_KEY)
  if (cached && cached.userId !== uid) {
    await chromeStorage.removeLocal(CACHE_KEY)
  }

  // 复用进行中的请求
  if (inflightLoad && inflightLoadUserId === uid && !forceRefresh) return inflightLoad

  // 缓存命中
  if (!forceRefresh && !isInitialized.value) {
    if (cached && cached.userId === uid && Date.now() - cached.timestamp < CACHE_DURATION) {
      subscription.value = cached.subscription
      subscriptionStatus.value = cached.subscriptionStatus
      isInitialized.value = true
      // 后台刷新
      inflightLoad = Promise.all([
        subscriptionAppService.getSubscriptionDetails(uid),
        subscriptionAppService.getUserSubscription(uid)
      ])
        .then(async ([d, s]) => {
          subscription.value = d
          subscriptionStatus.value = s
          if (d || s)
            await chromeStorage.setLocal(CACHE_KEY, {
              subscription: d,
              subscriptionStatus: s,
              timestamp: Date.now(),
              userId: uid
            })
          else await chromeStorage.removeLocal(CACHE_KEY)
        })
        .catch(async () => {
          await chromeStorage.removeLocal(CACHE_KEY)
        })
        .finally(() => {
          inflightLoad = null
          inflightLoadUserId = null
        })
      inflightLoadUserId = uid
      return
    }
  }

  loading.value = true
  error.value = null

  inflightLoad = Promise.all([
    subscriptionAppService.getSubscriptionDetails(uid),
    subscriptionAppService.getUserSubscription(uid)
  ])
    .then(async ([d, s]) => {
      subscription.value = d
      subscriptionStatus.value = s
      if (d || s)
        await chromeStorage.setLocal(CACHE_KEY, {
          subscription: d,
          subscriptionStatus: s,
          timestamp: Date.now(),
          userId: uid
        })
    })
    .catch(async err => {
      error.value = err instanceof Error ? err.message : '加载订阅状态失败'
      subscription.value = null
      subscriptionStatus.value = {
        tier: 'free',
        status: 'expired',
        current_period_end: new Date().toISOString(),
        cancel_at_period_end: false
      }
      await chromeStorage.removeLocal(CACHE_KEY)
    })
    .finally(() => {
      loading.value = false
      isInitialized.value = true
      inflightLoad = null
      inflightLoadUserId = null
    })
  inflightLoadUserId = uid

  return inflightLoad
}

export function useSubscription() {
  // watchEffect 只注册一次
  if (!watchAttached) {
    watchAttached = true
    watchEffect(() => {
      const { user, isAuthenticated } = useSupabaseAuth()
      const currentUserId = user.value?.id || null
      // 用户切换时清理缓存
      if (lastUserId !== null && currentUserId !== null && lastUserId !== currentUserId) {
        void chromeStorage.removeLocal(CACHE_KEY)
      }
      lastUserId = currentUserId

      if (isAuthenticated.value && user.value?.id) void loadSubscription()
      else {
        subscription.value = null
        subscriptionStatus.value = null
        isInitialized.value = true
        void chromeStorage.removeLocal(CACHE_KEY)
      }
    })
  }

  const checkout = async (billingFrequency: GumroadBillingFrequency) => {
    const { user, isAuthenticated } = useSupabaseAuth()
    if (!isAuthenticated.value || !user.value) throw new Error('请先登录')
    loading.value = true
    error.value = null
    try {
      window.open(
        await subscriptionAppService.createCheckoutLink(
          billingFrequency,
          user.value.id,
          user.value.email || ''
        ),
        '_blank'
      )
    } finally {
      loading.value = false
    }
  }

  return {
    subscription: computed(() => subscription.value),
    subscriptionStatus: computed(() => subscriptionStatus.value),
    loading: computed(() => loading.value),
    error: computed(() => error.value),
    isInitialized: computed(() => isInitialized.value),
    isPro,
    isExpiringSoon,
    isCancelledButActive,
    loadSubscription,
    clearCache: () => chromeStorage.removeLocal(CACHE_KEY),
    checkout,
    openManagePortal: () =>
      window.open(subscriptionAppService.getManagePortalUrl(), '_blank', 'noopener'),
    subscribeMonthly: () => checkout('monthly'),
    subscribeYearly: () => checkout('yearly')
  }
}
