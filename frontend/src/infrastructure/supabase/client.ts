/**
 * Supabase 客户端初始化
 *
 * 职责：
 * - 创建和管理 Supabase 客户端实例
 * - 配置认证选项
 * - 处理 Chrome Extension 环境的特殊配置
 * - 使用 Chrome Storage 存储 session（与官网同步）
 */

/* eslint-disable no-restricted-imports -- 这是 Supabase 客户端的封装层，必须直接导入 @supabase/supabase-js */
import { createClient, type User, type Session, type AuthError } from '@supabase/supabase-js'
import { logger } from '@/infrastructure/logging/logger'

/**
 * Supabase 配置
 *
 * 环境变量：
 * - VITE_SUPABASE_URL: Supabase 项目 URL
 * - VITE_SUPABASE_ANON_KEY: Supabase 匿名密钥（公开的，可在前端使用）
 */
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://ugxgxytykxblctsyulsg.supabase.co'
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_2FY9uDfqNbLwUYXxgcu8lw_qQ8SEbXo'

// 开发模式下打印环境变量状态（帮助调试）
if (import.meta.env.DEV) {
  logger.debug('Supabase', 'Config', '环境变量状态', {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseAnonKey,
    url: supabaseUrl ? `${supabaseUrl.substring(0, 30)}...` : 'undefined',
    keyPrefix: supabaseAnonKey ? `${supabaseAnonKey.substring(0, 20)}...` : 'undefined'
  })
}

// 检查配置是否完整
const isConfigured = !!(supabaseUrl && supabaseAnonKey)

// 注意：Supabase 是可选功能（仅用于认证）
// 未配置时应用仍可正常使用核心书签管理功能
// 如需检查配置，可运行: bun ./scripts/check-supabase-config.mjs

/**
 * Chrome Storage Adapter for Supabase Auth
 *
 * 使用 Chrome Storage 存储 session，实现插件与官网的认证状态同步
 */
const chromeStorageAdapter = {
  async getItem(key: string): Promise<string | null> {
    try {
      const result = await chrome.storage.local.get(key)
      const value = result[key] as string | undefined
      return value || null
    } catch (error) {
      console.error('[ChromeStorageAdapter] getItem 失败:', error)
      return null
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    try {
      await chrome.storage.local.set({ [key]: value })
    } catch (error) {
      console.error('[ChromeStorageAdapter] setItem 失败:', error)
    }
  },
  async removeItem(key: string): Promise<void> {
    try {
      await chrome.storage.local.remove(key)
    } catch (error) {
      console.error('[ChromeStorageAdapter] removeItem 失败:', error)
    }
  }
}

/**
 * 创建 Supabase 客户端
 *
 * Chrome Extension 环境配置：
 * - storage: 使用 Chrome Storage（通过 Content Script 与官网同步）
 * - autoRefreshToken: 自动刷新 token
 * - persistSession: 持久化 session
 *
 * 注意：如果环境变量未配置，使用占位符 URL 避免崩溃
 * 实际使用时应该通过 isSupabaseConfigured() 检查配置状态
 */

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      // 🔑 使用 Chrome Storage 存储 session
      // Content Script 会监听官网的 localStorage 变化，并同步到 Chrome Storage
      // 这样插件就能自动获取官网的登录状态
      storage: chromeStorageAdapter,
      storageKey: 'supabase.auth.token', // 自定义 storage key
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false // Chrome Extension 不需要检测 URL 中的 session
    }
  }
)

/**
 * 验证 Supabase 配置是否完整
 */
export function isSupabaseConfigured(): boolean {
  console.warn(
    '[Supabase Client] ⚠️ Supabase 配置检查: ' + (isConfigured ? '✅ 已配置' : '❌ 未配置')
  )
  return isConfigured
}

/**
 * 导出 Supabase 类型（供外部使用）
 */
export type { User, Session, AuthError }
