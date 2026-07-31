/**
 * Cloudflare Worker 环境变量类型定义
 */

import type { Ai, KVNamespace } from '@cloudflare/workers-types'

export interface Env {
  // Bindings
  AI: Ai
  AI_USAGE_KV?: KVNamespace

  // Secrets & Vars from wrangler.toml
  JWT_SECRET: string
  SUPABASE_URL: string
  SUPABASE_ANON_KEY: string
  SUPABASE_SERVICE_ROLE_KEY: string
  WEBSITE_URL: string

  AUTH_GOOGLE_CLIENT_ID?: string
  AUTH_GOOGLE_CLIENT_SECRET?: string
  AUTH_MICROSOFT_CLIENT_ID?: string
  AUTH_MICROSOFT_CLIENT_SECRET?: string

  GUMROAD_SELLER_ID?: string

  REDIRECT_URI_ALLOWLIST?: string
  REDIRECT_ALLOWLIST?: string

  // For local dev
  SECRET?: string
  NODE_ENV?: string

  // Auth URLs (optional overrides)
  AUTH_GOOGLE_AUTH_URL?: string
  AUTH_GOOGLE_TOKEN_URL?: string
  AUTH_GOOGLE_USERINFO_URL?: string
  AUTH_MICROSOFT_AUTH_URL?: string
  AUTH_MICROSOFT_TOKEN_URL?: string
  AUTH_MICROSOFT_USERINFO_URL?: string

  /** Pro 托管 LLM：DeepSeek API Key（Secret） */
  DEEPSEEK_API_KEY?: string
  /** Pro 托管 LLM：DeepSeek API Base URL */
  DEEPSEEK_API_BASE?: string
  /** Pro 托管 LLM：模型名称 */
  AI_HOSTED_MODEL?: string
  /** Pro 托管 LLM：每月调用次数上限 */
  AI_HOSTED_MONTHLY_QUOTA?: string

  /**
   * M1 线索理解代理开关；设为 "false" 关闭。
   * 未设置则在配置了 DEEPSEEK_API_KEY 时可用。
   */
  AI_CLUE_PROXY_ENABLED?: string
  /** 线索理解按 IP 日调用上限（默认 200） */
  AI_CLUE_DAILY_LIMIT?: string
}
