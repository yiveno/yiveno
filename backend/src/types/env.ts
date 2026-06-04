/**
 * Cloudflare Worker 环境变量类型定义
 */

import type { Ai } from '@cloudflare/workers-types'

export interface Env {
  // Bindings
  AI: Ai

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
}
