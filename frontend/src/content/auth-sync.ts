/**
 * 认证状态同步 Content Script
 * 
 * 职责：
 * - 监听官网 localStorage 中的 Supabase session 变化
 * - 将 session 同步到 Chrome Extension Storage
 * - 实现官网和插件的认证状态自动同步
 */

console.log('[AuthSync] Content Script 已加载')

// 只在官网域名下运行
const WEBSITE_DOMAINS = [
  'localhost:3000', // ✅ 修复：官网实际运行在 3000 端口
  'localhost:3001',
  'acuitybookmarks.com',
  'www.acuitybookmarks.com'
]

const currentHost = window.location.host
const isWebsiteDomain = WEBSITE_DOMAINS.some(domain => 
  currentHost.includes(domain)
)

console.log('[AuthSync] 当前域名:', currentHost)
console.log('[AuthSync] 是否为官网域名:', isWebsiteDomain)

if (!isWebsiteDomain) {
  console.log('[AuthSync] 非官网域名，跳过同步')
} else {
  console.log('[AuthSync] 官网域名，开始监听 session 变化')

  /**
   * 从 localStorage 读取 Supabase session
   */
  function getSupabaseSession() {
    try {
      console.log('[AuthSync] 开始读取 localStorage...')
      console.log('[AuthSync] localStorage keys:', Object.keys(localStorage))
      
      // Supabase 的 session key 格式：sb-<project-ref>-auth-token
      const keys = Object.keys(localStorage).filter(key => 
        key.startsWith('sb-') && key.endsWith('-auth-token')
      )
      
      console.log('[AuthSync] 找到的 Supabase keys:', keys)
      
      if (keys.length === 0) {
        console.log('[AuthSync] localStorage 中没有 session')
        return null
      }
      
      const sessionKey = keys[0]
      const sessionData = localStorage.getItem(sessionKey)
      
      console.log('[AuthSync] sessionKey:', sessionKey)
      console.log('[AuthSync] sessionData length:', sessionData?.length || 0)
      
      if (!sessionData) {
        return null
      }
      
      const session = JSON.parse(sessionData)
      console.log('[AuthSync] 读取到 session:', {
        hasAccessToken: !!session.access_token,
        hasRefreshToken: !!session.refresh_token,
        userId: session.user?.id,
        expiresAt: session.expires_at
      })
      
      return session
    } catch (error) {
      console.error('[AuthSync] 读取 session 失败:', error)
      return null
    }
  }

  /**
   * 将 session 同步到 Chrome Storage
   */
  async function syncSessionToExtension(session) {
    try {
      if (!session) {
        console.log('[AuthSync] Session 为空，清除扩展 session')
        await chrome.runtime.sendMessage({
          type: 'CLEAR_AUTH_SESSION'
        })
        return
      }
      
      console.log('[AuthSync] 同步 session 到扩展...')
      await chrome.runtime.sendMessage({
        type: 'SYNC_AUTH_SESSION',
        data: {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_at: session.expires_at,
          user: session.user
        }
      })
      console.log('[AuthSync] ✅ Session 已同步到扩展')
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
    
    console.log('[AuthSync] 初始化状态检查:', {
      hasLocalSession: !!localSession,
      hasChromeSession
    })
    
    // 情况 1：localStorage 有 session，同步到 Chrome Storage
    if (localSession) {
      console.log('[AuthSync] 发现 localStorage session，同步到扩展')
      await syncSessionToExtension(localSession)
    }
    // 情况 2：localStorage 没有 session，但 Chrome Storage 有（不一致）
    else if (hasChromeSession) {
      console.log('[AuthSync] ⚠️ localStorage 无 session，但 Chrome Storage 有，清除扩展 session')
      await syncSessionToExtension(null)
    }
    // 情况 3：两边都没有 session（正常）
    else {
      console.log('[AuthSync] 两边都没有 session，状态一致')
    }
  }
  
  // 执行初始化同步
  initializeSync()

  /**
   * 监听 localStorage 变化（只能监听其他标签页的变化）
   */
  window.addEventListener('storage', (event) => {
    // 只关心 Supabase session 的变化
    if (event.key?.startsWith('sb-') && event.key?.endsWith('-auth-token')) {
      console.log('[AuthSync] 检测到 storage 事件（其他标签页）')
      
      if (event.newValue) {
        try {
          const session = JSON.parse(event.newValue)
          syncSessionToExtension(session)
        } catch (error) {
          console.error('[AuthSync] 解析 session 失败:', error)
        }
      } else {
        // Session 被删除（登出）
        console.log('[AuthSync] 检测到 session 被删除（登出）')
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
  const keys = Object.keys(localStorage).filter(key => 
    key.startsWith('sb-') && key.endsWith('-auth-token')
  )
  if (keys.length > 0) {
    lastSessionData = localStorage.getItem(keys[0])
  }

  /**
   * 定期检查 session（检测当前标签页的变化）
   */
  setInterval(() => {
    const keys = Object.keys(localStorage).filter(key => 
      key.startsWith('sb-') && key.endsWith('-auth-token')
    )
    
    const currentSessionData = keys.length > 0 ? localStorage.getItem(keys[0]) : null
    
    // 检查 session 是否发生变化
    if (currentSessionData !== lastSessionData) {
      console.log('[AuthSync] 检测到 localStorage 变化（当前标签页）', {
        hadSession: !!lastSessionData,
        hasSession: !!currentSessionData
      })
      
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
        console.log('[AuthSync] 检测到 session 被删除（登出）')
        syncSessionToExtension(null)
      }
    }
  }, 1000) // 每 1 秒检查一次（更频繁，以便快速检测登出）

  console.log('[AuthSync] 监听器已设置')
}

