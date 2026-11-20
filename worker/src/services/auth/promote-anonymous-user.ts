/**
 * 匿名转正：device Bearer + email → Admin updateUser；device token 继续有效。
 * Confirm email OFF：邮箱当场生效，不发 OTP。
 */

import { createSupabaseClient, hasSupabase } from '../../data-access/supabase'
import type { Env } from '../../types/env'
import { error as logErrorMessage, info, toLogError, warn } from '../../utils/logger'
import { getUserMeta, putUserMeta } from './device-token-kv'

/** 与 billing 邮件校验同口径的简易邮箱格式。 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type PromoteAnonymousUserResult =
  | {
      ok: true
      data: { userId: string; email: string; isAnonymous: false }
      /** 已是非匿名时幂等返回 */
      idempotent?: true
    }
  | {
      ok: false
      status: 400 | 409 | 500 | 503
      error:
        | 'invalid_email'
        | 'email_conflict'
        | 'supabase_not_configured'
        | 'kv_unavailable'
        | 'kv_put_failed'
        | 'promote_failed'
    }

/** Admin 错误归一化（exactOptionalPropertyTypes：缺省键勿写 undefined） */
export type PromoteAdminError = {
  code?: string
  message?: string
  status?: number
}

/** Admin updateUserById 可注入（单测）；生产默认走 service_role 客户端。 */
export type PromoteAdminUpdateUser = (
  userId: string,
  attributes: { email: string; email_confirm: true }
) => Promise<{
  data: { user: { id: string; email?: string | null } | null }
  error: PromoteAdminError | null
}>

export type PromoteAnonymousUserDeps = {
  updateUserById?: PromoteAdminUpdateUser
}

/** 把 supabase-js AuthError 收成可注入契约（去掉 undefined 字段）。 */
function normalizePromoteAdminError(error: {
  code?: string | undefined
  message?: string | undefined
  status?: number | undefined
}): PromoteAdminError {
  const out: PromoteAdminError = {}
  if (error.code != null && error.code !== '') {
    out.code = String(error.code)
  }
  if (error.message != null && error.message !== '') {
    out.message = error.message
  }
  if (error.status != null) {
    out.status = error.status
  }
  return out
}

/** 日志用：掩码邮箱（保留首字符与域名）。 */
export function maskEmailForLog(email: string): string {
  const trimmed = email.trim()
  const at = trimmed.indexOf('@')
  if (at <= 0) return '***'
  const local = trimmed.slice(0, at)
  const domain = trimmed.slice(at + 1)
  const head = local.slice(0, 1)
  return `${head}***@${domain || '***'}`
}

/**
 * 将 Admin updateUser 冲突类错误映射为 email_conflict。
 * 不透传原始 message。
 */
export function mapPromoteAdminError(
  error: PromoteAdminError
): 'email_conflict' | 'promote_failed' {
  const code = (error.code ?? '').toLowerCase()
  if (
    code === 'email_exists' ||
    code === 'user_already_exists' ||
    code === 'email_conflict_identity_not_deletable'
  ) {
    return 'email_conflict'
  }
  const message = (error.message ?? '').toLowerCase()
  if (
    message.includes('already been registered') ||
    message.includes('already registered') ||
    message.includes('email address already') ||
    message.includes('duplicate') ||
    message.includes('unique constraint')
  ) {
    return 'email_conflict'
  }
  if (error.status === 422 || error.status === 409) {
    if (message.includes('email') || code.includes('email')) {
      return 'email_conflict'
    }
  }
  return 'promote_failed'
}

/**
 * 同 userId 绑定邮箱并翻转 user_meta.isAnonymous。
 * 不重发 device token；不碰 lifetime 配额计数器。
 */
export async function promoteAnonymousUser(
  env: Env,
  userId: string,
  rawEmail: string,
  deps: PromoteAnonymousUserDeps = {}
): Promise<PromoteAnonymousUserResult> {
  const email = rawEmail.trim()
  if (!email || !EMAIL_RE.test(email)) {
    return { ok: false, status: 400, error: 'invalid_email' }
  }

  const existingMeta = await getUserMeta(env, userId)
  // 已非匿名：幂等 200（以 user_meta 为准）
  if (existingMeta && existingMeta.isAnonymous === false) {
    const resolvedEmail = existingMeta.email?.trim() || email
    info('[Auth] promote 幂等（已非匿名）', {
      userId,
      emailMasked: maskEmailForLog(resolvedEmail)
    })
    return {
      ok: true,
      idempotent: true,
      data: { userId, email: resolvedEmail, isAnonymous: false }
    }
  }

  let updateUserById: PromoteAdminUpdateUser
  if (deps.updateUserById) {
    updateUserById = deps.updateUserById
  } else {
    if (!hasSupabase(env)) {
      return { ok: false, status: 503, error: 'supabase_not_configured' }
    }
    const admin = createSupabaseClient(env)
    if (!admin) {
      return { ok: false, status: 503, error: 'supabase_not_configured' }
    }
    updateUserById = async (uid, attributes) => {
      const { data, error } = await admin.auth.admin.updateUserById(uid, attributes)
      return {
        data: { user: data.user },
        error: error ? normalizePromoteAdminError(error) : null
      }
    }
  }

  try {
    const { data, error } = await updateUserById(userId, {
      email,
      email_confirm: true
    })
    if (error) {
      const mapped = mapPromoteAdminError(error)
      warn('[Auth] promote Admin updateUser 失败', {
        userId,
        emailMasked: maskEmailForLog(email),
        mapped,
        detail: toLogError(error)
      })
      if (mapped === 'email_conflict') {
        return { ok: false, status: 409, error: 'email_conflict' }
      }
      return { ok: false, status: 500, error: 'promote_failed' }
    }
    const confirmedEmail = data.user?.email?.trim() || email
    const now = new Date().toISOString()
    const metaPut = await putUserMeta(env, userId, {
      isAnonymous: false,
      email: confirmedEmail,
      updatedAt: now
    })
    if (!metaPut.ok) {
      logErrorMessage('[Auth] promote 写 user_meta 失败', {
        userId,
        error: metaPut.error
      })
      return {
        ok: false,
        status: metaPut.error === 'kv_unavailable' ? 503 : 500,
        error: metaPut.error
      }
    }
    info('[Auth] promote 成功', {
      userId,
      emailMasked: maskEmailForLog(confirmedEmail)
    })
    return {
      ok: true,
      data: { userId, email: confirmedEmail, isAnonymous: false }
    }
  } catch (err) {
    logErrorMessage('[Auth] promote 异常', {
      userId,
      emailMasked: maskEmailForLog(email),
      detail: toLogError(err)
    })
    return { ok: false, status: 500, error: 'promote_failed' }
  }
}
