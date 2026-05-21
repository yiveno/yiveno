/**
 * 订阅状态管理 Composable（官网专用）
 * 
 * 使用缓存策略优化性能：
 * - 首次加载：立即从缓存读取（避免闪烁），然后从 Supabase 刷新
 * - 后续加载：先显示缓存，后台刷新
 * - 缓存时长：15 分钟
 */

const CACHE_KEY = 'acuity_subscription_cache'
const CACHE_DURATION = 15 * 60 * 1000 // 15 分钟

interface SubscriptionCache {
  data: SubscriptionRecord | null
  timestamp: number
  userId: string // 添加用户 ID，确保缓存对应正确的用户
}

interface SubscriptionRecord {
  tier: string
  status: string
  current_period_end: string
}

export const useSubscription = () => {
  const { user } = useAuth()
  const { supabase } = useSupabase()
  
  const subscription = ref<SubscriptionRecord | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const isInitialized = ref(false) // 是否已初始化

  /**
   * 是否为 PRO 用户
   */
  const isPro = computed(() => {
    if (!subscription.value) return false
    return (
      subscription.value.tier === 'pro' &&
      subscription.value.status === 'active' &&
      new Date(subscription.value.current_period_end) > new Date()
    )
  })

  /**
   * 订阅等级
   */
  const tier = computed(() => {
    return subscription.value?.tier || 'free'
  })

  /**
   * 订阅状态
   */
  const status = computed(() => {
    return subscription.value?.status || 'expired'
  })

  /**
   * 到期时间
   */
  const expiryDate = computed(() => {
    if (!subscription.value?.current_period_end) return null
    return new Date(subscription.value.current_period_end)
  })

  /**
   * 从缓存读取订阅数据（带用户 ID 验证）
   */
  const loadFromCache = (userId: string): SubscriptionRecord | null => {
    if (typeof window === 'undefined') return null
    
    try {
      const cached = localStorage.getItem(CACHE_KEY)
      if (!cached) return null

      const { data, timestamp, userId: cachedUserId }: SubscriptionCache = JSON.parse(cached)
      const now = Date.now()

      // 检查用户 ID 是否匹配
      if (cachedUserId !== userId) {
        console.log('[useSubscription] 缓存用户不匹配，清除缓存')
        localStorage.removeItem(CACHE_KEY)
        return null
      }

      // 检查缓存是否过期
      if (now - timestamp > CACHE_DURATION) {
        console.log('[useSubscription] 缓存已过期')
        localStorage.removeItem(CACHE_KEY)
        return null
      }

      console.log('[useSubscription] 使用缓存数据')
      return data
    } catch (err) {
      console.error('[useSubscription] 读取缓存失败:', err)
      return null
    }
  }

  /**
   * 保存订阅数据到缓存
   */
  const saveToCache = (data: SubscriptionRecord | null, userId: string) => {
    if (typeof window === 'undefined') return
    
    try {
      const cache: SubscriptionCache = {
        data,
        timestamp: Date.now(),
        userId
      }
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
      console.log('[useSubscription] 已缓存订阅数据')
    } catch (err) {
      console.error('[useSubscription] 保存缓存失败:', err)
    }
  }

  /**
   * 清除缓存（用于强制刷新）
   */
  const clearCache = () => {
    if (typeof window === 'undefined') return
    localStorage.removeItem(CACHE_KEY)
    console.log('[useSubscription] 已清除缓存')
  }

  /**
   * 从 Supabase 加载订阅状态
   */
  const fetchFromSupabase = async () => {
    if (!user.value?.id) {
      return null
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.value.id)
        .eq('status', 'active')
        .gt('current_period_end', new Date().toISOString())
        .order('current_period_end', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (fetchError) {
        console.error('[useSubscription] 查询订阅失败:', fetchError)
        throw fetchError
      }

      console.log('[useSubscription] 从 Supabase 获取订阅数据:', data)
      return data
    } catch (err) {
      console.error('[useSubscription] 加载订阅异常:', err)
      throw err
    }
  }

  /**
   * 加载订阅状态（带缓存）
   */
  const loadSubscription = async (forceRefresh = false) => {
    const userId = user.value?.id
    
    if (!userId) {
      subscription.value = null
      loading.value = false
      // 这里是同步分支中的状态收束，不存在跨 await 竞争
      // eslint-disable-next-line require-atomic-updates
      isInitialized.value = true
      return
    }

    try {
      // 先尝试从缓存同步加载（立即显示，避免闪烁）
      if (!forceRefresh && !isInitialized.value) {
        const cached = loadFromCache(userId)
        if (cached) {
          subscription.value = cached
          // 缓存命中后立即标记初始化完成，后台刷新不会依赖旧值
          // eslint-disable-next-line require-atomic-updates
          isInitialized.value = true
          console.log('[useSubscription] 立即显示缓存数据')
          
          // 后台刷新（不阻塞 UI，不改变 loading 状态）
          fetchFromSupabase()
            .then(data => {
              subscription.value = data
              if (data) {
                saveToCache(data, userId)
              } else {
                // 如果后台刷新发现订阅已过期，清除缓存
                clearCache()
              }
            })
            .catch(err => {
              console.error('[useSubscription] 后台刷新失败:', err)
            })
          
          return
        }
      }

      // 缓存未命中，显示 loading 并从 Supabase 获取
      loading.value = true
      error.value = null

      const data = await fetchFromSupabase()
      subscription.value = data
      
      if (data) {
        saveToCache(data, userId)
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : '加载订阅失败'
    } finally {
      loading.value = false
      // finally 中统一收束状态，ESLint 对 ref 赋值会误报 require-atomic-updates
      // eslint-disable-next-line require-atomic-updates
      isInitialized.value = true
    }
  }

  // 监听用户登录状态变化
  watch(() => user.value?.id, (newUserId, oldUserId) => {
    if (newUserId && newUserId !== oldUserId) {
      // 用户登录或切换，重新加载订阅
      isInitialized.value = false
      loadSubscription()
    } else if (!newUserId) {
      // 用户退出登录
      subscription.value = null
      // 用户退出登录时直接重置状态，不存在并发写入风险
      // eslint-disable-next-line require-atomic-updates
      isInitialized.value = true
      clearCache()
    }
  }, { immediate: true })

  return {
    subscription: computed(() => subscription.value),
    loading: computed(() => loading.value),
    error: computed(() => error.value),
    isInitialized: computed(() => isInitialized.value),
    isPro,
    tier,
    status,
    expiryDate,
    loadSubscription,
    clearCache // 暴露给外部，用于强制刷新
  }
}
