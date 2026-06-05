/**
 * 认证状态同步 Content Script
 *
 * 职责：
 * - 仅在当前构建环境允许的官网域名上运行
 * - 监听官网 localStorage 中的 Supabase session
 * - 同步到 Chrome Storage（环境隔离的 storage key）
 *
 * ⚠️ Content Script 运行在网页环境，必须使用 localStorage 读取官网 session
 */

/* eslint-disable no-restricted-syntax -- Content Script 必须使用 localStorage 读取官网的 Supabase session */

import {
  AUTH_STORAGE_KEY,
  AUTH_SUPABASE_URL,
  getSupabaseProjectRef,
  getWebsiteSupabaseSessionKey,
  isAuthSyncHostAllowed
} from '@/config/auth-sync-env'
import { parseWebsiteAuthStorage, type AuthSyncSessionPayload } from '@/config/auth-sync-session'

const currentHost = window.location.host

/** 扩展重载后旧 content script 会失效，避免每秒刷错误日志 */
function isExtensionContextValid(): boolean {
  try {
    return Boolean(chrome.runtime?.id)
  } catch {
    return false
  }
}

function isExtensionContextInvalidatedError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('Extension context invalidated')
}

if (!isAuthSyncHostAllowed(currentHost)) {
  // 非本环境官网（如 dev 扩展访问 ottersage.com），彻底不同步
} else {
  const projectRef = getSupabaseProjectRef(AUTH_SUPABASE_URL)
  const websiteSessionKey = projectRef ? getWebsiteSupabaseSessionKey(projectRef) : null

  let syncDisabled = false
  let pollTimer: ReturnType<typeof setInterval> | null = null
  let contextInvalidLogged = false

  function disableSync(reason: string): void {
    if (syncDisabled) {
      return
    }
    syncDisabled = true
    if (pollTimer !== null) {
      clearInterval(pollTimer)
      pollTimer = null
    }
    if (!contextInvalidLogged) {
      contextInvalidLogged = true
      console.info(`[AuthSync] ${reason}，已停止同步。请刷新本页以恢复。`)
    }
  }

  /**
   * 从 localStorage 读取与当前扩展 Supabase 项目一致的 session
   */
  function getSupabaseSession(): AuthSyncSessionPayload | null {
    if (!websiteSessionKey) {
      return null
    }

    try {
      const sessionData = localStorage.getItem(websiteSessionKey)
      if (!sessionData) {
        return null
      }
      const session = parseWebsiteAuthStorage(sessionData)
      if (!session) {
        console.warn('[AuthSync] localStorage session 格式无法解析:', websiteSessionKey)
      }
      return session
    } catch (error) {
      console.error('[AuthSync] 读取 session 失败:', error)
      return null
    }
  }

  /**
   * 将 session 同步到 Chrome Storage
   */
  async function syncSessionToExtension(session: AuthSyncSessionPayload | null): Promise<boolean> {
    if (syncDisabled) {
      return false
    }

    if (!isExtensionContextValid()) {
      disableSync('扩展上下文已失效（常见于扩展重载后）')
      return false
    }

    try {
      if (!session) {
        const response = await chrome.runtime.sendMessage({ type: 'CLEAR_AUTH_SESSION' })
        if (
          response &&
          typeof response === 'object' &&
          'success' in response &&
          !response.success
        ) {
          console.error('[AuthSync] 清除 session 失败:', response)
          return false
        }
        return true
      }

      const response = await chrome.runtime.sendMessage({
        type: 'SYNC_AUTH_SESSION',
        data: session
      })
      if (response && typeof response === 'object' && 'success' in response && !response.success) {
        console.error('[AuthSync] 同步 session 失败:', response)
        return false
      }
      return true
    } catch (error) {
      if (isExtensionContextInvalidatedError(error)) {
        disableSync('扩展上下文已失效（常见于扩展重载后）')
        return false
      }
      console.error('[AuthSync] 同步 session 失败:', error)
      return false
    }
  }

  /**
   * 初始化：对齐官网 localStorage 与扩展 Chrome Storage
   */
  async function initializeSync() {
    if (!isExtensionContextValid()) {
      disableSync('扩展上下文不可用')
      return
    }

    const localSession = getSupabaseSession()
    const chromeSession = await chrome.storage.local.get(AUTH_STORAGE_KEY)
    const hasChromeSession = !!chromeSession[AUTH_STORAGE_KEY]

    if (localSession) {
      await syncSessionToExtension(localSession)
    } else if (hasChromeSession) {
      await syncSessionToExtension(null)
    }
  }

  void initializeSync()

  window.addEventListener('storage', event => {
    if (syncDisabled || !websiteSessionKey || event.key !== websiteSessionKey) {
      return
    }

    if (event.newValue) {
      const session = parseWebsiteAuthStorage(event.newValue)
      if (session) {
        void syncSessionToExtension(session)
      } else {
        console.error('[AuthSync] storage 事件 session 解析失败')
      }
    } else {
      void syncSessionToExtension(null)
    }
  })

  let lastSessionData: string | null = websiteSessionKey
    ? localStorage.getItem(websiteSessionKey)
    : null

  pollTimer = setInterval(() => {
    if (syncDisabled || !websiteSessionKey) {
      return
    }

    if (!isExtensionContextValid()) {
      disableSync('扩展上下文已失效（常见于扩展重载后）')
      return
    }

    const currentSessionData = localStorage.getItem(websiteSessionKey)
    if (currentSessionData === lastSessionData) {
      return
    }

    lastSessionData = currentSessionData

    if (currentSessionData) {
      const session = parseWebsiteAuthStorage(currentSessionData)
      if (session) {
        void syncSessionToExtension(session)
      } else {
        console.error('[AuthSync] 轮询 session 解析失败')
      }
    } else {
      void syncSessionToExtension(null)
    }
  }, 1000)
}
