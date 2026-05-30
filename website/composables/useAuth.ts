/**
 * 认证 Composable（仅 OAuth）
 *
 * 职责：
 * - 封装 Supabase OAuth 认证（Google、Microsoft）
 * - 提供统一的认证接口
 * - 处理认证状态管理
 * - 同步认证状态到 Chrome 扩展
 */

import { ref, computed } from 'vue'
import type { User, Session } from '@supabase/supabase-js'

/**
 * 认证状态（全局单例）
 */
const user = ref<User | null>(null)
const session = ref<Session | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

/**
 * 检查当前浏览器是否可与扩展通信
 */
const getChromeRuntime = () => {
  if (typeof window === 'undefined') return null
  return window.chrome?.runtime?.sendMessage ? window.chrome.runtime : null
}

/**
 * 向 Chrome 扩展发送认证同步消息
 */
const sendExtensionMessage = async (
  extensionId: string,
  message: Record<string, unknown>
): Promise<boolean> => {
  const runtime = getChromeRuntime()
  if (!runtime) return false

  await runtime.sendMessage(extensionId, message)
  return true
}

export const useAuth = () => {
  const { supabase } = useSupabase()
  const config = useRuntimeConfig()

  /**
   * 初始化：检查当前 session
   */
  const initialize = async () => {
    try {
      loading.value = true
      console.log('[useAuth] 开始初始化，检查 session...')

      const {
        data: { session: currentSession },
        error: sessionError
      } = await supabase.auth.getSession()

      if (sessionError) {
        console.error('[useAuth] 获取 session 失败:', sessionError)
        throw sessionError
      }

      console.log('[useAuth] Session 获取成功:', {
        hasSession: !!currentSession,
        userId: currentSession?.user?.id,
        email: currentSession?.user?.email
      })

      session.value = currentSession
      user.value = currentSession?.user ?? null

      console.log('[useAuth] 初始化完成，登录状态:', !!user.value)
    } catch (err) {
      error.value = err instanceof Error ? err.message : '获取 session 失败'
      console.error('[useAuth] 初始化失败:', err)
      session.value = null
      user.value = null
    } finally {
      loading.value = false
    }
  }

  /**
   * OAuth 登录（Google、Microsoft）
   *
   * @param provider - OAuth 提供商：'google' 或 'microsoft'
   * @returns Promise<{ url: string }>
   */
  const signInWithOAuth = async (provider: 'google' | 'microsoft'): Promise<{ url: string }> => {
    try {
      loading.value = true
      error.value = null

      console.log('[useAuth] 开始 OAuth 登录:', provider)

      // Supabase 内部使用 'azure' 作为 Microsoft 的 provider 名称
      const supabaseProvider = provider === 'microsoft' ? 'azure' : provider

      // 获取当前 URL 作为回调地址
      const redirectUrl = `${window.location.origin}/auth/callback`

      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: supabaseProvider as 'google' | 'azure',
        options: {
          redirectTo: redirectUrl,
          scopes: provider === 'microsoft' ? 'openid profile email User.Read' : undefined
          // 移除 queryParams，使用默认的 OAuth 行为
          // 如果用户已登录且已授权，会直接完成登录
          // 如果是首次登录，会显示授权页面
        }
      })

      if (oauthError) {
        console.error('[useAuth] Supabase signInWithOAuth 错误:', oauthError)
        throw new Error(`OAuth 错误: ${oauthError.message}`)
      }

      if (!data?.url) {
        console.error('[useAuth] Supabase 未返回授权 URL')
        throw new Error('未获取到授权 URL')
      }

      console.log('[useAuth] 获取到授权 URL')

      return { url: data.url }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'OAuth 登录失败'
      error.value = errorMsg
      console.error('[useAuth] OAuth 登录失败:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Google One Tap 登录
   *
   * @param idToken - Google ID Token（从 One Tap 回调中获取）
   * @returns Promise<{ user: User, session: Session }>
   */
  const signInWithGoogleOneTap = async (idToken: string) => {
    try {
      loading.value = true
      error.value = null

      console.log('[useAuth] 开始 Google One Tap 登录...')

      const { data, error: signInError } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken
      })

      if (signInError) {
        console.error('[useAuth] Google One Tap 登录失败:', signInError)
        throw new Error(`One Tap 登录错误: ${signInError.message}`)
      }

      if (!data.user || !data.session) {
        console.error('[useAuth] One Tap 登录未返回用户信息')
        throw new Error('One Tap 登录失败：未获取到用户信息')
      }

      console.log('[useAuth] One Tap 登录成功:', {
        userId: data.user.id,
        email: data.user.email
      })

      session.value = data.session
      user.value = data.user

      return { user: data.user, session: data.session }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'One Tap 登录失败'
      error.value = errorMsg
      console.error('[useAuth] One Tap 登录失败:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 设置 OAuth Session（从回调中获取的 token）
   */
  const setOAuthSession = async (accessToken: string, refreshToken: string) => {
    try {
      loading.value = true
      console.log('[useAuth] 设置 OAuth session...')

      const { data, error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken
      })

      if (sessionError) {
        console.error('[useAuth] 设置 session 失败:', sessionError)
        throw sessionError
      }

      console.log('[useAuth] Session 设置成功:', {
        userId: data.user?.id,
        email: data.user?.email
      })

      session.value = data.session
      user.value = data.user

      return { success: true }
    } catch (err) {
      error.value = err instanceof Error ? err.message : '设置 session 失败'
      console.error('[useAuth] 设置 session 失败:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 登出
   */
  const signOut = async () => {
    try {
      loading.value = true
      const { error: signOutError } = await supabase.auth.signOut()

      if (signOutError) {
        throw signOutError
      }

      user.value = null
      session.value = null

      console.log('[useAuth] 登出成功')
    } catch (err) {
      error.value = err instanceof Error ? err.message : '登出失败'
      console.error('[useAuth] 登出失败:', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * 监听认证状态变化
   */
  const setupAuthListener = () => {
    supabase.auth.onAuthStateChange(async (event: string, newSession: Session | null) => {
      console.log('[useAuth] 认证状态变化:', event, {
        hasSession: !!newSession,
        userId: newSession?.user?.id
      })

      session.value = newSession
      user.value = newSession?.user ?? null

      // 🔑 当用户登录成功时，通知 Chrome 扩展同步 session
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && newSession) {
        console.log('[useAuth] 🔔 通知 Chrome 扩展同步 session...')
        try {
          const didSend = await sendExtensionMessage(config.public.extensionId, {
            type: 'SYNC_AUTH_SESSION',
            data: {
              access_token: newSession.access_token,
              refresh_token: newSession.refresh_token,
              expires_at: newSession.expires_at,
              user: newSession.user
            }
          })
          if (didSend) {
            console.log('[useAuth] ✅ Session 已同步到扩展')
          }
        } catch (extensionError) {
          // 扩展未安装或通信失败，不影响网站功能
          console.warn('[useAuth] ⚠️ 无法同步到扩展（扩展可能未安装）:', extensionError)
        }
      }

      // 🔑 当用户登出时，通知 Chrome 扩展清除 session
      if (event === 'SIGNED_OUT') {
        console.log('[useAuth] 🔔 通知 Chrome 扩展清除 session...')
        try {
          const didSend = await sendExtensionMessage(config.public.extensionId, {
            type: 'CLEAR_AUTH_SESSION'
          })
          if (didSend) {
            console.log('[useAuth] ✅ 扩展 session 已清除')
          }
        } catch (extensionError) {
          console.warn('[useAuth] ⚠️ 无法清除扩展 session:', extensionError)
        }
      }
    })
  }

  /**
   * 监听其他标签页/窗口的认证状态变化
   */
  const setupStorageListener = () => {
    if (typeof window === 'undefined') return

    const handleStorageChange = async (e: StorageEvent) => {
      // 监听 Supabase 的 storage 变化
      if (e.key?.startsWith('sb-') && e.key.includes('-auth-token')) {
        console.log('[useAuth] 检测到其他标签页的认证状态变化')

        // 重新获取 session
        const {
          data: { session: currentSession },
          error: sessionError
        } = await supabase.auth.getSession()

        if (!sessionError && currentSession) {
          console.log('[useAuth] 同步认证状态成功')
          session.value = currentSession
          user.value = currentSession.user
        } else if (!currentSession) {
          console.log('[useAuth] 同步登出状态')
          session.value = null
          user.value = null
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)

    // 返回清理函数
    return () => {
      window.removeEventListener('storage', handleStorageChange)
    }
  }

  return {
    // 状态
    user: computed(() => user.value),
    session: computed(() => session.value),
    loading: computed(() => loading.value),
    error: computed(() => error.value),
    isAuthenticated: computed(() => !!user.value),

    // 方法
    initialize,
    signInWithOAuth,
    signInWithGoogleOneTap,
    setOAuthSession,
    signOut,
    setupAuthListener,
    setupStorageListener
  }
}
