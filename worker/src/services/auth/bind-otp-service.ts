/**
 * 绑定 OTP 发码 / 验码：Turnstile + 限流 + DirectMail + claimToken 签发。
 * 本模块不做邮箱存在性查询于发码路径（防枚举）；验码后 listUsers 分叉。
 */

import { createSupabaseClient, hasSupabase } from '../../data-access/supabase'
import type { Env } from '../../types/env'
import { error as logErrorMessage, info, warn } from '../../utils/logger'
import {
  AdminUserLookupError,
  findUserByEmail,
  type AdminListUsersClient,
  type FindUserByEmailResult
} from './admin-user-lookup'
import {
  BIND_OTP_COOLDOWN_MS,
  BIND_OTP_MAX_ATTEMPTS,
  BIND_OTP_TTL_SECONDS,
  checkBindOtpRateLimits,
  deleteBindOtpRecord,
  generateBindOtpCode,
  getBindOtpRecord,
  incrementBindOtpRateLimits,
  isValidBindEmail,
  normalizeBindEmail,
  sha256Hex,
  storeBindOtpRecord,
  timingSafeEqualHex,
  type BindOtpKv
} from './bind-otp-codes'
import { sendBindOtpMail, type BindOtpLocale } from './bind-otp-mail'
import { maskEmailForLog } from './promote-anonymous-user'
import { verifyTurnstileToken, type TurnstileVerifyResult } from './turnstile-verify'
import type { DirectMailSendResult } from '../email/aliyun-directmail'

const BINDCLAIM_PREFIX = 'bindclaim:' as const
const CLAIM_TOKEN_TTL_SECONDS = 600

export type BindBranch = 'promote' | 'claim'

export type BindClaimRecord = {
  anonUserId: string
  email: string
  branch: BindBranch
  targetUserId?: string
  createdAt: number
}

export type RequestBindCodeInput = {
  userId: string
  deviceId: string
  ip: string | null
  email: string
  turnstileToken: string | undefined | null
  locale: BindOtpLocale
}

export type RequestBindCodeResult =
  | { ok: true }
  | {
      ok: false
      status: 400 | 429 | 502 | 503
      error:
        | 'invalid_email'
        | 'captcha_required'
        | 'captcha_failed'
        | 'captcha_not_configured'
        | 'rate_limited'
        | 'email_not_configured'
        | 'email_send_failed'
        | 'kv_unavailable'
    }

export type VerifyBindCodeInput = {
  userId: string
  email: string
  code: string
}

export type VerifyBindCodeResult =
  | {
      ok: true
      data: { branch: BindBranch; claimToken: string }
    }
  | {
      ok: false
      status: 400 | 429 | 502 | 503
      error:
        | 'invalid_email'
        | 'code_not_found'
        | 'code_expired'
        | 'invalid_code'
        | 'too_many_attempts'
        | 'auth_lookup_failed'
        | 'kv_unavailable'
        | 'supabase_not_configured'
      remainingAttempts?: number
    }

export type BindOtpServiceDeps = {
  kv?: BindOtpKv
  now?: () => number
  verifyTurnstile?: (
    env: Env,
    token: string | undefined | null,
    opts?: { remoteIp?: string }
  ) => Promise<TurnstileVerifyResult>
  sendMail?: (
    env: Env,
    email: string,
    code: string,
    locale: BindOtpLocale
  ) => Promise<DirectMailSendResult>
  /** 验码后查邮箱；可注入。生产默认走 findUserByEmail + Admin 客户端 */
  findUserByEmail?: (normalizedEmail: string) => Promise<FindUserByEmailResult>
  createAdminClient?: () => AdminListUsersClient | null
  generateCode?: () => string
  createClaimToken?: () => string
}

function resolveKv(env: Env, deps: BindOtpServiceDeps): BindOtpKv | null {
  if (deps.kv) return deps.kv
  if (!env.AI_USAGE_KV) return null
  return env.AI_USAGE_KV as unknown as BindOtpKv
}

/** 32 字节随机 → 64 hex */
export function createBindClaimToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  let hex = ''
  for (const b of bytes) {
    hex += b.toString(16).padStart(2, '0')
  }
  return hex
}

export function bindClaimKvKey(token: string): string {
  return `${BINDCLAIM_PREFIX}${token}`
}

async function putClaimRecord(
  kv: BindOtpKv,
  token: string,
  record: BindClaimRecord
): Promise<void> {
  await kv.put(bindClaimKvKey(token), JSON.stringify(record), {
    expirationTtl: CLAIM_TOKEN_TTL_SECONDS
  })
}

/**
 * 发绑定验证码。成功响应不透露邮箱是否已注册。
 */
export async function requestBindCode(
  env: Env,
  input: RequestBindCodeInput,
  deps: BindOtpServiceDeps = {}
): Promise<RequestBindCodeResult> {
  if (!isValidBindEmail(input.email)) {
    return { ok: false, status: 400, error: 'invalid_email' }
  }
  const email = normalizeBindEmail(input.email)
  const emailMasked = maskEmailForLog(email)
  const now = deps.now?.() ?? Date.now()
  const kv = resolveKv(env, deps)
  if (!kv) {
    return { ok: false, status: 503, error: 'kv_unavailable' }
  }

  const verify = deps.verifyTurnstile ?? ((e, token, opts) => verifyTurnstileToken(e, token, opts))
  const captcha = await verify(env, input.turnstileToken, {
    ...(input.ip ? { remoteIp: input.ip } : {})
  })
  if (!captcha.ok) {
    if (captcha.reason === 'missing_secret') {
      return { ok: false, status: 503, error: 'captcha_not_configured' }
    }
    if (captcha.reason === 'missing_token') {
      return { ok: false, status: 400, error: 'captcha_required' }
    }
    return { ok: false, status: 400, error: 'captcha_failed' }
  }

  const existing = await getBindOtpRecord(env, email, kv)
  if (existing && now - existing.createdAt < BIND_OTP_COOLDOWN_MS) {
    return { ok: false, status: 429, error: 'rate_limited' }
  }

  const deviceKey = input.deviceId.trim() || input.userId
  const rate = await checkBindOtpRateLimits(
    env,
    {
      normalizedEmail: email,
      deviceKey,
      ip: input.ip,
      now: new Date(now)
    },
    kv
  )
  if (rate.skippedIp && !input.ip) {
    warn('[Auth] bind 发码缺 CF-Connecting-IP，跳过 IP 限流维', {
      userId: input.userId
    })
  }
  if (rate.limited) {
    return { ok: false, status: 429, error: 'rate_limited' }
  }

  const code = (deps.generateCode ?? generateBindOtpCode)()
  const sendMail = deps.sendMail ?? sendBindOtpMail
  const mailResult = await sendMail(env, email, code, input.locale)
  if (!mailResult.ok) {
    if (mailResult.reason === 'not_configured') {
      return { ok: false, status: 503, error: 'email_not_configured' }
    }
    warn('[Auth] bind 发信失败', {
      userId: input.userId,
      emailMasked,
      detail: mailResult.detail
    })
    return { ok: false, status: 502, error: 'email_send_failed' }
  }

  const codeHash = await sha256Hex(code)
  const put = await storeBindOtpRecord(
    env,
    email,
    {
      codeHash,
      attempts: 0,
      createdAt: now,
      expiresAt: now + BIND_OTP_TTL_SECONDS * 1000
    },
    kv
  )
  if (!put.ok) {
    return { ok: false, status: 503, error: 'kv_unavailable' }
  }

  await incrementBindOtpRateLimits(
    env,
    {
      normalizedEmail: email,
      deviceKey,
      ip: input.ip,
      now: new Date(now)
    },
    kv
  )

  info('[Auth] bind_code_sent', {
    userId: input.userId,
    emailMasked
  })
  return { ok: true }
}

/**
 * 验码 → 分叉 promote/claim → 签发 claimToken（消费在 V2）。
 */
export async function verifyBindCode(
  env: Env,
  input: VerifyBindCodeInput,
  deps: BindOtpServiceDeps = {}
): Promise<VerifyBindCodeResult> {
  if (!isValidBindEmail(input.email)) {
    return { ok: false, status: 400, error: 'invalid_email' }
  }
  const email = normalizeBindEmail(input.email)
  const emailMasked = maskEmailForLog(email)
  const now = deps.now?.() ?? Date.now()
  const kv = resolveKv(env, deps)
  if (!kv) {
    return { ok: false, status: 503, error: 'kv_unavailable' }
  }

  const record = await getBindOtpRecord(env, email, kv)
  if (!record) {
    return { ok: false, status: 400, error: 'code_not_found' }
  }
  if (now >= record.expiresAt) {
    await deleteBindOtpRecord(env, email, kv)
    return { ok: false, status: 400, error: 'code_expired' }
  }

  const code = input.code.trim()
  const codeHash = await sha256Hex(code)
  if (!timingSafeEqualHex(codeHash, record.codeHash)) {
    const attempts = record.attempts + 1
    if (attempts >= BIND_OTP_MAX_ATTEMPTS) {
      await deleteBindOtpRecord(env, email, kv)
      return { ok: false, status: 429, error: 'too_many_attempts' }
    }
    await storeBindOtpRecord(env, email, { ...record, attempts }, kv)
    return {
      ok: false,
      status: 400,
      error: 'invalid_code',
      remainingAttempts: BIND_OTP_MAX_ATTEMPTS - attempts
    }
  }

  // 一码一次：先删 OTP
  await deleteBindOtpRecord(env, email, kv)

  let lookup: FindUserByEmailResult
  try {
    if (deps.findUserByEmail) {
      lookup = await deps.findUserByEmail(email)
    } else {
      let admin: AdminListUsersClient | null = null
      if (deps.createAdminClient) {
        admin = deps.createAdminClient()
      } else if (hasSupabase(env)) {
        admin = createSupabaseClient(env) as unknown as AdminListUsersClient | null
      }
      if (!admin) {
        return { ok: false, status: 503, error: 'supabase_not_configured' }
      }
      lookup = await findUserByEmail(admin, email)
    }
  } catch (err) {
    if (err instanceof AdminUserLookupError) {
      logErrorMessage('[Auth] bind 邮箱查找失败', {
        userId: input.userId,
        emailMasked,
        code: err.code
      })
      return { ok: false, status: 502, error: 'auth_lookup_failed' }
    }
    logErrorMessage('[Auth] bind 邮箱查找异常', {
      userId: input.userId,
      emailMasked
    })
    return { ok: false, status: 502, error: 'auth_lookup_failed' }
  }

  const branch: BindBranch = lookup.found ? 'claim' : 'promote'
  const claimRecord: BindClaimRecord = {
    anonUserId: input.userId,
    email,
    branch,
    createdAt: now,
    ...(lookup.found ? { targetUserId: lookup.userId } : {})
  }
  const claimToken = (deps.createClaimToken ?? createBindClaimToken)()
  try {
    await putClaimRecord(kv, claimToken, claimRecord)
  } catch {
    return { ok: false, status: 503, error: 'kv_unavailable' }
  }

  info('[Auth] bind_verified', {
    userId: input.userId,
    branch,
    emailMasked
  })
  return { ok: true, data: { branch, claimToken } }
}
