/**
 * claim-by-otp：持 claim 分支 claimToken 为目标账号签发新 device token。
 * 不碰旧匿名会话（不删 anon user、不撤旧 device token——扩展 V3 处置）。
 */

import { createSupabaseClient, hasSupabase } from '../../data-access/supabase'
import type { Env } from '../../types/env'
import { error as logErrorMessage, info, warn } from '../../utils/logger'
import type { BindOtpKv } from './bind-otp-codes'
import {
  getBindClaimRecord,
  validateAndConsumeClaimToken,
  type BindClaimRecord
} from './bind-otp-service'
import { issueForAuthenticatedUser, type DeviceRegisterResult } from './device-register'
import { maskEmailForLog } from './promote-anonymous-user'

export type ClaimByOtpInput = {
  anonUserId: string
  /** 一次性 claimToken；邮箱从记录读取，不信任 body */
  claimToken: string
  deviceLabel?: string | null
  platform?: string | null
  extensionId?: string | null
}

export type ClaimByOtpResult =
  | Extract<DeviceRegisterResult, { ok: true }>
  | {
      ok: false
      status: 401 | 403 | 404 | 500 | 503
      error: string
    }

export type ClaimByOtpDeps = {
  kv?: BindOtpKv
  /** 只读 peek；可注入 */
  peekClaim?: typeof getBindClaimRecord
  /** 校验+消费 claimToken；可注入 */
  validateClaim?: typeof validateAndConsumeClaimToken
  /** Admin getUserById；可注入 */
  getUserById?: (userId: string) => Promise<{
    data: { user: { id: string; email?: string | null } | null }
    error: { message?: string } | null
  }>
  /** 签发 device；可注入（默认 issueForAuthenticatedUser） */
  issueDevice?: typeof issueForAuthenticatedUser
}

function resolveKv(env: Env, kv?: BindOtpKv): BindOtpKv | null {
  if (kv) return kv
  if (!env.AI_USAGE_KV) return null
  return env.AI_USAGE_KV as unknown as BindOtpKv
}

/**
 * 消费 claim 分支 token → 为目标用户签发新 device token。
 * 邮箱取自 claim 记录，不接受调用方覆盖。
 */
export async function claimByOtp(
  env: Env,
  input: ClaimByOtpInput,
  deps: ClaimByOtpDeps = {}
): Promise<ClaimByOtpResult> {
  const kv = resolveKv(env, deps.kv)
  if (!kv) {
    return { ok: false, status: 503, error: 'kv_unavailable' }
  }

  const peek = deps.peekClaim ?? getBindClaimRecord
  const peeked = await peek(kv, input.claimToken)
  if (!peeked) {
    return { ok: false, status: 401, error: 'invalid_claim' }
  }

  const email = peeked.email
  const emailMasked = maskEmailForLog(email)

  const validate = deps.validateClaim ?? validateAndConsumeClaimToken
  const consumed = await validate(kv, input.claimToken, {
    anonUserId: input.anonUserId,
    email,
    branch: 'claim'
  })
  if (!consumed.ok) {
    return { ok: false, status: 401, error: 'invalid_claim' }
  }

  const record: BindClaimRecord = consumed.record
  const targetUserId = record.targetUserId?.trim()
  if (!targetUserId) {
    warn('[Auth] claim 记录缺 targetUserId', {
      anonUserId: input.anonUserId,
      emailMasked
    })
    return { ok: false, status: 404, error: 'claim_user_not_found' }
  }

  let getUserById = deps.getUserById
  if (!getUserById) {
    if (!hasSupabase(env)) {
      return { ok: false, status: 503, error: 'supabase_not_configured' }
    }
    const admin = createSupabaseClient(env)
    if (!admin) {
      return { ok: false, status: 503, error: 'supabase_not_configured' }
    }
    getUserById = async userId => {
      const { data, error } = await admin.auth.admin.getUserById(userId)
      return {
        data: { user: data.user },
        error: error ? { message: error.message } : null
      }
    }
  }

  try {
    const { data, error } = await getUserById(targetUserId)
    if (error || !data.user?.id) {
      warn('[Auth] claim 目标用户不存在', {
        anonUserId: input.anonUserId,
        emailMasked
      })
      return { ok: false, status: 404, error: 'claim_user_not_found' }
    }
  } catch (err) {
    logErrorMessage('[Auth] claim getUserById 异常', {
      anonUserId: input.anonUserId,
      emailMasked,
      detail: err instanceof Error ? err.message : String(err)
    })
    return { ok: false, status: 500, error: 'claim_failed' }
  }

  const issueDevice = deps.issueDevice ?? issueForAuthenticatedUser
  const issued = await issueDevice(env, {
    userId: targetUserId,
    email,
    isAnonymous: false,
    ...(input.deviceLabel ? { deviceLabel: input.deviceLabel } : {}),
    ...(input.platform ? { platform: input.platform } : {}),
    ...(input.extensionId ? { extensionId: input.extensionId } : {})
  })

  if (!issued.ok) {
    // device-register 错误码原样透传（含 403 device_limit_reached）
    if (issued.status === 403 || issued.status === 503 || issued.status === 500) {
      return { ok: false, status: issued.status, error: issued.error }
    }
    return { ok: false, status: 500, error: issued.error }
  }

  info('[Auth] claim_by_otp 成功', {
    anonUserId: input.anonUserId,
    targetUserId,
    emailMasked,
    deviceId: issued.data.deviceId
  })
  return issued
}
