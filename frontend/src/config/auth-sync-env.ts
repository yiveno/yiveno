/**
 * 官网 ↔ 扩展 认证同步的环境隔离配置
 *
 * dev 构建：仅 localhost 官网 + `supabase.auth.token.dev`
 * prod 构建：仅生产域名 + `supabase.auth.token`
 */

/**
 * 使用 import.meta.env 而非 env.ts，避免 content script IIFE 打包引入 zod
 */
const AUTH_RUNTIME_RAW = import.meta.env.VITE_RUNTIME_ENV

/** 当前扩展构建环境（由 VITE_RUNTIME_ENV 在构建时注入） */
export const AUTH_RUNTIME_ENV: 'dev' | 'prod' = AUTH_RUNTIME_RAW === 'prod' ? 'prod' : 'dev'

/** 与官网一致的 Supabase 项目 URL（用于匹配 localStorage key） */
export const AUTH_SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://ugxgxytykxblctsyulsg.supabase.co'

/** 本构建使用的 Supabase session 存储键（与另一环境物理隔离） */
export const AUTH_STORAGE_KEY =
  AUTH_RUNTIME_ENV === 'prod' ? 'supabase.auth.token' : 'supabase.auth.token.dev'

/** 历史/跨环境键，启动时清除非当前环境的条目 */
export const ALL_AUTH_STORAGE_KEYS = ['supabase.auth.token', 'supabase.auth.token.dev'] as const

/**
 * 允许注入 auth-sync 并同步 session 的官网 host（精确匹配）
 */
export const AUTH_SYNC_ALLOWED_HOSTS: readonly string[] =
  AUTH_RUNTIME_ENV === 'prod'
    ? ['ottersage.com', 'www.ottersage.com']
    : ['localhost:3000', 'localhost:3001']

/**
 * 当前 host 是否允许向本扩展同步认证
 */
export function isAuthSyncHostAllowed(host: string): boolean {
  return AUTH_SYNC_ALLOWED_HOSTS.includes(host)
}

/**
 * 从 Supabase URL 提取 project ref（用于匹配官网 localStorage key）
 */
export function getSupabaseProjectRef(supabaseUrl: string): string | null {
  try {
    const ref = new URL(supabaseUrl).hostname.split('.')[0]
    return ref || null
  } catch {
    return null
  }
}

/**
 * 官网 localStorage 中 Supabase session 的 key
 */
export function getWebsiteSupabaseSessionKey(projectRef: string): string {
  return `sb-${projectRef}-auth-token`
}

/**
 * 清除另一环境的 session，避免 dev 扩展误用生产登录态
 */
export async function purgeCrossEnvironmentAuthStorage(): Promise<void> {
  const keysToRemove: string[] = [
    ...ALL_AUTH_STORAGE_KEYS.filter(key => key !== AUTH_STORAGE_KEY),
    'ottersage_subscription_cache'
  ]
  if (keysToRemove.length === 0) {
    return
  }
  await chrome.storage.local.remove(keysToRemove)
}
