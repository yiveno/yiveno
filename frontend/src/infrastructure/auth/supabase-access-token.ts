/**
 * 从 Chrome Storage 读取 Supabase Access Token
 */

import { AUTH_STORAGE_KEY } from '@/config/auth-sync-env'
import { logger } from '@/infrastructure/logging/logger'

interface StoredSession {
  access_token?: string
  currentSession?: {
    access_token?: string
  }
}

/**
 * 获取当前登录用户的 Supabase Access Token
 */
export async function getSupabaseAccessToken(): Promise<string | null> {
  try {
    const result = (await chrome.storage.local.get([AUTH_STORAGE_KEY])) as Record<
      string,
      string | undefined
    >
    const sessionStr = result[AUTH_STORAGE_KEY]
    if (!sessionStr) {
      return null
    }

    const session = JSON.parse(sessionStr) as StoredSession
    return session.access_token ?? session.currentSession?.access_token ?? null
  } catch (error) {
    logger.warn('SupabaseAccessToken', '读取 Access Token 失败', error)
    return null
  }
}
