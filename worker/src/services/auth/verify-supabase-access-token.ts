/**
 * 在服务端校验 Supabase access token。
 *
 * 按 Supabase 最新建议优先走 `auth.getClaims(token)`：
 * - 非对称签名：SDK 通过 JWKS + WebCrypto 本地验签
 * - 对称签名：SDK 自动回退到 Auth 服务校验
 *
 * 本地 wrangler dev 需要先修好 Node TLS 信任链，否则 SDK 的网络回退会失败。
 */

import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

/** Supabase access token payload 中本中间件所需字段 */
const supabaseAccessTokenPayloadSchema = z.object({
  sub: z.string().min(1),
  email: z.string().email().optional().nullable(),
  role: z.string().optional(),
  aud: z.union([z.string(), z.array(z.string())]).optional()
})

export type VerifiedSupabaseUser = {
  id: string
  email: string | null
}

export type VerifySupabaseAccessTokenResult =
  | { ok: true; user: VerifiedSupabaseUser }
  | {
      ok: false
      reason: 'invalid_token' | 'auth_unreachable' | 'malformed_response'
    }

export type VerifySupabaseAccessTokenOptions = {
  anonKey?: string
}

function claimsToUser(payload: unknown): VerifySupabaseAccessTokenResult {
  const parsed = supabaseAccessTokenPayloadSchema.safeParse(payload)
  if (!parsed.success) {
    return { ok: false, reason: 'malformed_response' }
  }

  if (parsed.data.role && parsed.data.role !== 'authenticated') {
    return { ok: false, reason: 'invalid_token' }
  }

  return {
    ok: true,
    user: {
      id: parsed.data.sub,
      email: parsed.data.email ?? null
    }
  }
}

/**
 * 用 Supabase SDK 校验 access token 并提取 claims。
 */
async function verifyViaGetClaims(
  supabaseUrl: string,
  anonKey: string,
  accessToken: string
): Promise<VerifySupabaseAccessTokenResult> {
  const supabase = createClient(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  try {
    const { data, error } = await supabase.auth.getClaims(accessToken)
    if (error) {
      return { ok: false, reason: 'invalid_token' }
    }
    return claimsToUser(data?.claims)
  } catch {
    return { ok: false, reason: 'auth_unreachable' }
  }
}

/**
 * 校验 Supabase Bearer access token。
 */
export async function verifySupabaseAccessToken(
  supabaseUrl: string,
  accessToken: string,
  options: VerifySupabaseAccessTokenOptions = {}
): Promise<VerifySupabaseAccessTokenResult> {
  if (!options.anonKey) {
    return { ok: false, reason: 'auth_unreachable' }
  }

  return verifyViaGetClaims(supabaseUrl, options.anonKey, accessToken)
}
