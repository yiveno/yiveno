/**
 * Supabase 认证状态管理 Composable
 *
 * 职责：
 * - 读取和管理 Supabase 认证状态
 * - 监听认证状态变化
 * - 提供登出功能
 * - 检测用户不活跃超时（30 天）
 *
 * 同步机制：
 * - 插件和官网共享 localStorage 中的 Supabase session
 * - 通过 storage 事件实现跨标签页/跨环境自动同步
 * - 用户在官网登录后，插件会自动检测到 session 变化并同步状态
 *
 * 安全策略：
 * - Access Token 过期时间：1 小时
 * - Refresh Token 过期时间：60 天（需在 Supabase Dashboard 配置）
 * - 不活跃超时：30 天（本地检测）
 */

import { ref, computed } from 'vue'
import { supabase, isSupabaseConfigured } from '@/infrastructure/supabase/client'
import type { User, Session, AuthError } from '@/infrastructure/supabase/client'
import { logger } from '@/infrastructure/logging/logger'
import { chromeStorage } from '@/infrastructure/storage/chrome-storage'

/**
 * 不活跃超时时间：30 天（毫秒）
 * 如果用户 30 天内未使用应用，将自动登出
 */
const INACTIVITY_TIMEOUT = 30 * 24 * 60 * 60 * 1000

/**
 * 本地存储 key
 */
const STORAGE_KEYS = {
  LAST_ACTIVITY: 'auth_last_activity',
  DEVICE_FINGERPRINT: 'auth_device_fingerprint'
} as const

/**
 * 认证状态
 */
const user = ref<User | null>(null)
const session = ref<Session | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

/**
 * Supabase 认证状态管理 Composable
 */
export function useSupabaseAuth() {
  /**
   * 检查用户不活跃超时
   * 如果用户超过 30 天未使用应用，自动登出
   */
  const checkInactivity = async () => {
    if (!isSupabaseConfigured() || !user.value) {
      return
    }

    try {
      const lastActivity = await chromeStorage.getLocal<number>(STORAGE_KEYS.LAST_ACTIVITY)
      const now = Date.now()

      if (lastActivity && now - lastActivity > INACTIVITY_TIMEOUT) {
        logger.warn('[useSupabaseAuth] 🔒 用户超过 30 天未活跃，自动登出', {
          lastActivity: new Date(lastActivity).toISOString(),
          daysSinceLastActivity: Math.floor((now - lastActivity) / (24 * 60 * 60 * 1000))
        })

        await signOut()
        error.value = '您已超过 30 天未使用，为了安全已自动登出，请重新登录'
      } else {
        // 更新最后活跃时间
        await updateActivity()
      }
    } catch (err) {
      logger.error('[useSupabaseAuth] 检查不活跃超时失败:', err)
    }
  }

  /**
   * 更新用户最后活跃时间
   */
  const updateActivity = async () => {
    if (!isSupabaseConfigured() || !user.value) {
      return
    }

    try {
      await chromeStorage.setLocal(STORAGE_KEYS.LAST_ACTIVITY, Date.now())
      logger.debug('[useSupabaseAuth] ✅ 已更新最后活跃时间')
    } catch (err) {
      logger.error('[useSupabaseAuth] 更新活跃时间失败:', err)
    }
  }

  /**
   * 获取当前 session
   */
  const fetchSession = async () => {
    const {
      data: { session: currentSession },
      error: sessionError
    } = await supabase.auth.getSession()

    if (sessionError) {
      logger.error('[useSupabaseAuth] 获取 session 失败:', sessionError)
      console.error('[useSupabaseAuth] ❌ 获取 session 失败:', sessionError)
      throw sessionError
    }

    logger.debug('[useSupabaseAuth] Session 获取成功:', {
      hasSession: !!currentSession,
      userId: currentSession?.user?.id,
      email: currentSession?.user?.email
    })
    console.log('[useSupabaseAuth] ✅ Session 获取成功:', {
      hasSession: !!currentSession,
      userId: currentSession?.user?.id,
      email: currentSession?.user?.email
    })

    return currentSession
  }

  /**
   * 设置 session 和 user 状态
   */
  const setAuthState = (currentSession: Session | null) => {
    session.value = currentSession
    user.value = currentSession?.user ?? null
  }

  /**
   * 处理初始化错误
   */
  const handleInitializeError = (err: unknown) => {
    const authError = err as AuthError
    error.value = authError.message || '获取 session 失败'
    logger.error('[useSupabaseAuth] 初始化失败:', authError)
    console.error('[useSupabaseAuth] ❌ 初始化失败:', authError)
    setAuthState(null)
  }

  /**
   * 初始化：检查当前 session
   */
  const initialize = async () => {
    logger.warn('[useSupabaseAuth] 🚀 开始初始化认证状态...')
    if (!isSupabaseConfigured()) {
      loading.value = false
      error.value = 'Supabase 未配置'
      logger.warn('[useSupabaseAuth] ⚠️ Supabase 未配置，跳过认证初始化')
      return
    }

    try {
      loading.value = true
      logger.debug('[useSupabaseAuth] 开始初始化，检查 session...')
      console.log('[useSupabaseAuth] 🔍 开始获取 session...')

      const currentSession = await fetchSession()
      setAuthState(currentSession)

      // 🔒 检查不活跃超时
      if (user.value) {
        await checkInactivity()
      }

      logger.debug('[useSupabaseAuth] 初始化完成，登录状态:', !!user.value)
      console.log('[useSupabaseAuth] ✅ 初始化完成，登录状态:', !!user.value)
    } catch (err) {
      handleInitializeError(err)
    } finally {
      loading.value = false
    }
  }

  /**
   * 登出
   */
  const signOut = async () => {
    if (!isSupabaseConfigured()) {
      return
    }

    try {
      loading.value = true
      const { error: signOutError } = await supabase.auth.signOut()

      if (signOutError) {
        throw signOutError
      }

      user.value = null
      session.value = null

      // 🧹 清除本地活跃时间记录
      await chromeStorage.removeLocal(STORAGE_KEYS.LAST_ACTIVITY)

      logger.debug('[useSupabaseAuth] ✅ 登出成功')
    } catch (err) {
      const authError = err as AuthError
      error.value = authError.message || '登出失败'
      logger.error('[useSupabaseAuth] 登出失败:', authError)
      throw authError
    } finally {
      loading.value = false
    }
  }

  /**
   * 监听认证状态变化
   */
  let authStateSubscription: ReturnType<typeof supabase.auth.onAuthStateChange> | null = null

  const setupAuthListener = () => {
    if (authStateSubscription) {
      return // 已设置，避免重复订阅
    }

    authStateSubscription = supabase.auth.onAuthStateChange(async (event, newSession) => {
      logger.debug('[useSupabaseAuth] 认证状态变化:', event, {
        hasSession: !!newSession,
        userId: newSession?.user?.id
      })

      session.value = newSession
      user.value = newSession?.user ?? null

      // 🔑 当用户登出或 session 失效时，清除本地存储
      if (event === 'SIGNED_OUT' || !newSession) {
        logger.debug('[useSupabaseAuth] 🧹 清除本地用户数据...')
        try {
          await chromeStorage.removeLocal('current_login_provider')
          await chromeStorage.removeLocal(STORAGE_KEYS.LAST_ACTIVITY)
          logger.debug('[useSupabaseAuth] ✅ 已清除本地用户数据')
        } catch (err) {
          logger.error('[useSupabaseAuth] ❌ 清除本地数据失败:', err)
        }
      }

      // 🔒 当用户登录或 session 刷新时，更新活跃时间
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        await updateActivity()
      }
    })
  }

  /**
   * 取消订阅
   */
  const unsubscribe = () => {
    if (authStateSubscription) {
      authStateSubscription.data.subscription.unsubscribe()
      authStateSubscription = null
    }
  }

  // 🔑 监听 Chrome Storage 的变化（Content Script 同步的 session）
  // 注意：这个监听器必须在组件外部设置，否则会在 Popup 打开之前就被调用
  if (typeof chrome !== 'undefined' && chrome.storage) {
    console.log('[useSupabaseAuth] 👂 设置 Chrome Storage 监听器（全局）')
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes['supabase.auth.token']) {
        const change = changes['supabase.auth.token']
        console.log('[useSupabaseAuth] 📨 检测到 Chrome Storage session 变化:', {
          hasOldValue: !!change.oldValue,
          hasNewValue: !!change.newValue,
          isDeleted: change.newValue === undefined || change.newValue === null
        })

        // ✅ 如果 session 被删除（登出），立即清除本地状态
        if (change.newValue === undefined || change.newValue === null) {
          console.log('[useSupabaseAuth] 🧹 Session 已删除，清除本地状态...')
          logger.info('[useSupabaseAuth] 🧹 Session 已删除（用户登出），清除本地状态')

          // 立即清除状态
          user.value = null
          session.value = null

          // 清除本地存储
          void chromeStorage.removeLocal('current_login_provider')
          void chromeStorage.removeLocal(STORAGE_KEYS.LAST_ACTIVITY)
        } else {
          // Session 更新（登录或刷新），重新初始化
          logger.info('[useSupabaseAuth] 🔔 检测到 Chrome Storage session 变化，刷新状态...')
          void initialize()
        }
      }
    })
  }

  // ✅ 移除自动初始化的 onMounted，让调用者自己决定何时初始化
  // 调用者应该在自己的 onMounted 中调用 initialize() 和 setupAuthListener()

  return {
    // 状态
    user: computed(() => user.value),
    session: computed(() => session.value),
    loading: computed(() => loading.value),
    error: computed(() => error.value),
    isAuthenticated: computed(() => !!user.value),

    // 方法
    signOut,
    initialize,
    setupAuthListener, // ✅ 暴露给调用者，让调用者在 onMounted 中手动设置
    unsubscribe,
    updateActivity, // 暴露给外部调用，用于更新活跃时间
    checkInactivity // 暴露给外部调用，用于手动检查
  }
}
