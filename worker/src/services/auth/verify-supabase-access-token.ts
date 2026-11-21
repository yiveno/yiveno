/**
 * 在服务端校验 Supabase access token。
 *
 * 按 Supabase 最新建议优先走 `auth.getClaims(token)`：
 * - 非对称签名：SDK 通过 JWKS + WebCrypto 本地验签
 * - 对称签名：SDK 自动回退到 Auth 服务校验
 *
 * TLS 已排除（2026-11-21 实测：Node 直连 Supabase/Cloudflare/Google 均返回 HTTP 状态）。
 */

import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'

import { warn } from '../../utils/logger'

/**
 * JWT email claim：缺失 / null / ""（GoTrue 对匿名 NULL 邮箱常发空串）均视同无邮箱。
 * 合法邮箱串仍须通过 `.email()`。
 */
const supabaseEmailClaimSchema = z.preprocess(
  v => (v === '' ? undefined : v),
  z.string().email().optional().nullable()
)

/** Supabase access token payload 中本中间件所需字段 */
const supabaseAccessTokenPayloadSchema = z.object({
  sub: z.string().min(1),
  email: supabaseEmailClaimSchema,
  role: z.string().optional(),
  aud: z.union([z.string(), z.array(z.string())]).optional(),
  /** 匿名 Auth 用户；旧 token 可能无此 claim */
  is_anonymous: z.boolean().optional()
})

export type VerifiedSupabaseUser = {
  id: string
  email: string | null
  /** 来自 JWT `is_anonymous`；缺失按非匿名 */
  isAnonymous: boolean
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

/** SDK getClaims 失败时推断的验签路径（仅诊断，不替代 SDK 决策）。 */
export type GetClaimsVerifyPath = 'local_jwks' | 'auth_service_fallback' | 'unknown'

/** 解码 JWT 后用于诊断日志的安全摘要（不含签名 / 全文）。 */
export type DecodedJwtDiagnostic = {
  header: { alg: string | null; kid: string | null }
  claims: {
    role: string | null
    aud: string | string[] | null
    iss: string | null
    is_anonymous: boolean | null
    exp: number | null
    /** sub 前 8 字符；无则 null */
    subPrefix: string | null
  }
  verifyPath: GetClaimsVerifyPath
}

function base64UrlToUtf8(segment: string): string | null {
  try {
    const padded = segment.replace(/-/g, '+').replace(/_/g, '/')
    const padLen = (4 - (padded.length % 4)) % 4
    const b64 = padded + '='.repeat(padLen)
    const binary = atob(b64)
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0))
    return new TextDecoder().decode(bytes)
  } catch {
    return null
  }
}

/**
 * 不验签地解码 JWT header/payload，供 getClaims 失败诊断。
 * 路径推断对齐 auth-js getClaims：HS* / 无 kid / 无 WebCrypto → Auth 网络回退；否则本地 JWKS。
 */
export function decodeJwtForDiagnostics(accessToken: string): DecodedJwtDiagnostic | null {
  const parts = accessToken.split('.')
  if (parts.length < 2) {
    return null
  }
  const headerRaw = base64UrlToUtf8(parts[0] ?? '')
  const payloadRaw = base64UrlToUtf8(parts[1] ?? '')
  if (!headerRaw || !payloadRaw) {
    return null
  }

  let headerJson: unknown
  let payloadJson: unknown
  try {
    headerJson = JSON.parse(headerRaw)
    payloadJson = JSON.parse(payloadRaw)
  } catch {
    return null
  }

  const headerObj =
    typeof headerJson === 'object' && headerJson !== null
      ? (headerJson as Record<string, unknown>)
      : {}
  const payloadObj =
    typeof payloadJson === 'object' && payloadJson !== null
      ? (payloadJson as Record<string, unknown>)
      : {}

  const alg = typeof headerObj.alg === 'string' ? headerObj.alg : null
  const kid = typeof headerObj.kid === 'string' ? headerObj.kid : null

  const role = typeof payloadObj.role === 'string' ? payloadObj.role : null
  const iss = typeof payloadObj.iss === 'string' ? payloadObj.iss : null
  const exp = typeof payloadObj.exp === 'number' ? payloadObj.exp : null
  const isAnonymous = typeof payloadObj.is_anonymous === 'boolean' ? payloadObj.is_anonymous : null
  const sub = typeof payloadObj.sub === 'string' ? payloadObj.sub : null
  const audRaw = payloadObj.aud
  const aud =
    typeof audRaw === 'string'
      ? audRaw
      : Array.isArray(audRaw) && audRaw.every(v => typeof v === 'string')
        ? (audRaw as string[])
        : null

  const hasWebCrypto =
    typeof globalThis !== 'undefined' &&
    'crypto' in globalThis &&
    !!globalThis.crypto &&
    'subtle' in globalThis.crypto

  let verifyPath: GetClaimsVerifyPath = 'unknown'
  if (!alg || alg.startsWith('HS') || !kid || !hasWebCrypto) {
    verifyPath = 'auth_service_fallback'
  } else {
    verifyPath = 'local_jwks'
  }

  return {
    header: { alg, kid },
    claims: {
      role,
      aud,
      iss,
      is_anonymous: isAnonymous,
      exp,
      subPrefix: sub ? sub.slice(0, 8) : null
    },
    verifyPath
  }
}

function extractSdkErrorFields(error: unknown): {
  name: string | null
  message: string | null
  code: string | null
} {
  if (!error || typeof error !== 'object') {
    return { name: null, message: null, code: null }
  }
  const e = error as { name?: unknown; message?: unknown; code?: unknown }
  return {
    name: typeof e.name === 'string' ? e.name : null,
    message: typeof e.message === 'string' ? e.message : null,
    code: typeof e.code === 'string' ? e.code : null
  }
}

/** getClaims 返回 error 时写诊断 warn（禁止记 token 全文 / 签名）。 */
export function logGetClaimsFailure(accessToken: string, error: unknown): void {
  const sdkError = extractSdkErrorFields(error)
  const decoded = decodeJwtForDiagnostics(accessToken)
  warn('[VerifySupabase] getClaims 失败', {
    sdkErrorName: sdkError.name,
    sdkErrorMessage: sdkError.message,
    sdkErrorCode: sdkError.code,
    jwtAlg: decoded?.header.alg ?? null,
    jwtKid: decoded?.header.kid ?? null,
    claimRole: decoded?.claims.role ?? null,
    claimAud: decoded?.claims.aud ?? null,
    claimIss: decoded?.claims.iss ?? null,
    claimIsAnonymous: decoded?.claims.is_anonymous ?? null,
    claimExp: decoded?.claims.exp ?? null,
    claimSubPrefix: decoded?.claims.subPrefix ?? null,
    verifyPath: decoded?.verifyPath ?? 'unknown',
    decodeOk: decoded !== null
  })
}

/** claims 校验拒绝诊断（禁止记 token / 邮箱原文；只记字段名与布尔）。 */
function logClaimsToUserRejection(
  reason: 'malformed_response' | 'role_rejected',
  payload: unknown,
  zodIssues?: string[]
): void {
  const obj =
    typeof payload === 'object' && payload !== null ? (payload as Record<string, unknown>) : null
  if (reason === 'malformed_response') {
    warn('[VerifySupabase] claims 校验失败', {
      reason: 'malformed_response',
      zodIssues: zodIssues ?? [],
      role: typeof obj?.role === 'string' ? obj.role : null,
      hasSub: typeof obj?.sub === 'string' && obj.sub.length > 0,
      emailIsEmpty: obj?.email === '',
      isAnonymous: typeof obj?.is_anonymous === 'boolean' ? obj.is_anonymous : null
    })
    return
  }
  warn('[VerifySupabase] claims 校验失败', {
    reason: 'role_rejected',
    role: typeof obj?.role === 'string' ? obj.role : null
  })
}

function claimsToUser(payload: unknown): VerifySupabaseAccessTokenResult {
  const parsed = supabaseAccessTokenPayloadSchema.safeParse(payload)
  if (!parsed.success) {
    const zodIssues = [
      ...new Set(parsed.error.issues.map(issue => issue.path.map(String).join('.') || '(root)'))
    ]
    logClaimsToUserRejection('malformed_response', payload, zodIssues)
    return { ok: false, reason: 'malformed_response' }
  }

  if (parsed.data.role && parsed.data.role !== 'authenticated') {
    logClaimsToUserRejection('role_rejected', payload)
    return { ok: false, reason: 'invalid_token' }
  }

  return {
    ok: true,
    user: {
      id: parsed.data.sub,
      email: parsed.data.email ?? null,
      isAnonymous: parsed.data.is_anonymous ?? false
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
      logGetClaimsFailure(accessToken, error)
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
