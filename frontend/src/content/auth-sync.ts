/**
 * 认证状态同步 Content Script
 *
 * 职责：
 * - 监听官网 localStorage 中的 Supabase session 变化
 * - 将 session 同步到 Chrome Extension Storage
 * - 实现官网和插件的认证状态自动同步
 *
 * ⚠️ 注意：此文件是 Content Script，运行在网页环境中
 * 必须使用 localStorage 来读取官网的 Supabase session
 */

/* eslint-disable no-restricted-syntax -- Content Script 必须使用 localStorage 读取官网的 Supabase session */

// 只在官网域名下运行
const WEBSITE_DOMAINS = [
  'localhost:3000', // ✅ 修复：官网实际运行在 3000 端口
  'localhost:3001',
  'acuitybookmarks.com',
  'www.acuitybookmarks.com'
]

const currentHost = window.location.host
const isWebsiteDomain = WEBSITE_DOMAINS.some(domain => currentHost.includes(domain))

interface SupabaseSession {
  access_token?: string
  refresh_token?: string
  expires_at?: number
  user?: unknown
}

if (!isWebsiteDomain) {
  // 非官网域名，跳过同步
} else {
  /**
   * 从 localStorage 读取 Supabase session
   */
  function getSupabaseSession(): SupabaseSession | null {
    try {
      // Supabase 的 session key 格式：sb-<project-ref>-auth-token
      const keys = Object.keys(localStorage).filter(
        key => key.startsWith('sb-') && key.endsWith('-auth-token')
      )

      if (keys.length === 0) {
        return null
      }

      const sessionKey = keys[0]
      if (!sessionKey) {
        return null
      }

      const sessionData = localStorage.getItem(sessionKey)

      if (!sessionData) {
        return null
      }

      const session = JSON.parse(sessionData) as SupabaseSession
      return session
    } catch (error) {
      console.error('[AuthSync] 读取 session 失败:', error)
      return null
    }
  }

  /**
   * 将 session 同步到 Chrome Storage
   */
  async function syncSessionToExtension(session: SupabaseSession | null) {
    try {
      if (!session) {
        await chrome.runtime.sendMessage({
          type: 'CLEAR_AUTH_SESSION'
        })
        return
      }

      await chrome.runtime.sendMessage({
        type: 'SYNC_AUTH_SESSION',
        data: {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_at: session.expires_at,
          user: session.user
        }
      })
    } catch (error) {
      console.error('[AuthSync] 同步 session 失败:', error)
    }
  }

  /**
   * 初始化：检查 localStorage 和 Chrome Storage 的一致性
   */
  async function initializeSync() {
    const localSession = getSupabaseSession()

    // 从 Chrome Storage 读取当前存储的 session
    const chromeSession = await chrome.storage.local.get('supabase.auth.token')
    const hasChromeSession = !!chromeSession['supabase.auth.token']

    // 情况 1：localStorage 有 session，同步到 Chrome Storage
    if (localSession) {
      await syncSessionToExtension(localSession)
    }
    // 情况 2：localStorage 没有 session，但 Chrome Storage 有（不一致）
    else if (hasChromeSession) {
      await syncSessionToExtension(null)
    }
  }

  // 执行初始化同步
  initializeSync()

  /**
   * 监听 localStorage 变化（只能监听其他标签页的变化）
   */
  window.addEventListener('storage', event => {
    // 只关心 Supabase session 的变化
    if (event.key?.startsWith('sb-') && event.key?.endsWith('-auth-token')) {
      if (event.newValue) {
        try {
          const session = JSON.parse(event.newValue)
          syncSessionToExtension(session)
        } catch (error) {
          console.error('[AuthSync] 解析 session 失败:', error)
        }
      } else {
        // Session 被删除（登出）
        syncSessionToExtension(null)
      }
    }
  })

  /**
   * 使用 MutationObserver 监听 localStorage 的变化（当前标签页）
   *
   * 注意：storage 事件只能监听其他标签页的变化，无法监听当前标签页
   * 因此我们需要定期轮询来检测当前标签页的 localStorage 变化
   */
  let lastSessionData: string | null = null

  // 获取初始 session 数据
  const keys = Object.keys(localStorage).filter(
    key => key.startsWith('sb-') && key.endsWith('-auth-token')
  )
  if (keys.length > 0) {
    const firstKey = keys[0]
    if (firstKey) {
      lastSessionData = localStorage.getItem(firstKey)
    }
  }

  /**
   * 定期检查 session（检测当前标签页的变化）
   */
  setInterval(() => {
    const sessionKeys = Object.keys(localStorage).filter(
      key => key.startsWith('sb-') && key.endsWith('-auth-token')
    )

    const firstSessionKey = sessionKeys[0]
    const currentSessionData = firstSessionKey ? localStorage.getItem(firstSessionKey) : null

    // 检查 session 是否发生变化
    if (currentSessionData !== lastSessionData) {
      lastSessionData = currentSessionData

      if (currentSessionData) {
        try {
          const session = JSON.parse(currentSessionData)
          syncSessionToExtension(session)
        } catch (error) {
          console.error('[AuthSync] 解析 session 失败:', error)
        }
      } else {
        // Session 被删除（登出）
        syncSessionToExtension(null)
      }
    }
  }, 1000) // 每 1 秒检查一次（更频繁，以便快速检测登出）
}
