/**
 * 匿名用户定期清理：超期 is_anonymous 行 → 先清 KV（device / meta / 配额）再 Admin deleteUser。
 * 默认 dry-run（ANON_CLEANUP_DRY_RUN !== 'false'）；每轮上限 500。
 */

import { buildLifetimeUsageKey } from '../../config/ai-hosted'
import { createSupabaseClient, hasSupabase } from '../../data-access/supabase'
import { buildAnonymousEmbedUsageKey } from '../../handlers/ai-embed'
import type { Env } from '../../types/env'
import { error as logErrorMessage, info, warn } from '../../utils/logger'
import { deleteUserMeta, revokeAllDevicesForUser } from './device-token-kv'

/** 不活跃阈值：90 天 */
export const ANON_CLEANUP_RETENTION_MS = 90 * 24 * 60 * 60 * 1000

/** 单轮删除上限（封顶爆炸半径） */
export const ANON_CLEANUP_MAX_PER_RUN = 500

/** Admin listUsers 每页条数 */
export const ANON_CLEANUP_LIST_PER_PAGE = 100

/** 筛选用最小用户字段（可注入假实现） */
export type AnonCleanupUser = {
  id: string
  /** Supabase Auth is_anonymous */
  is_anonymous?: boolean | null
  last_sign_in_at?: string | null
  created_at?: string | null
}

export type AnonymousCleanupResult = {
  dryRun: boolean
  /** 分页扫描到的用户总数 */
  scanned: number
  /** 符合删除条件的数量（含因 500 上限未处理的） */
  matched: number
  /** 真删成功数，或 dry-run「将删除」数 */
  deletedOrWouldDelete: number
  failed: number
  /** 是否因 500 上限截断 */
  capped: boolean
}

export type ListUsersPageFn = (
  page: number,
  perPage: number
) => Promise<{ users: AnonCleanupUser[]; error: { message?: string } | null }>

export type DeleteUserFn = (userId: string) => Promise<{ error: { message?: string } | null }>

export type AnonymousCleanupDeps = {
  listUsersPage?: ListUsersPageFn
  deleteUser?: DeleteUserFn
  revokeAllDevices?: (userId: string) => Promise<void>
  deleteUserMetaKv?: (userId: string) => Promise<void>
  deleteAnonymousQuotaKeys?: (userId: string) => Promise<void>
  now?: Date
}

/** 未设或非 `'false'` → dry-run；仅显式 `'false'` 真删。 */
export function isAnonCleanupDryRun(env: Pick<Env, 'ANON_CLEANUP_DRY_RUN'> | Env): boolean {
  return (env as Env).ANON_CLEANUP_DRY_RUN !== 'false'
}

/**
 * 是否入选删除集：匿名且（last_sign_in_at 超 90 天，或从未登录且 created_at 超 90 天）。
 * 已转正（is_anonymous !== true）永不入选。
 */
export function isStaleAnonymousUser(user: AnonCleanupUser, now: Date = new Date()): boolean {
  if (user.is_anonymous !== true) return false
  const cutoff = now.getTime() - ANON_CLEANUP_RETENTION_MS
  const lastSignIn = user.last_sign_in_at?.trim()
  if (lastSignIn) {
    const ts = Date.parse(lastSignIn)
    return Number.isFinite(ts) && ts < cutoff
  }
  const created = user.created_at?.trim()
  if (!created) return false
  const createdTs = Date.parse(created)
  return Number.isFinite(createdTs) && createdTs < cutoff
}

async function defaultDeleteAnonymousQuotaKeys(env: Env, userId: string): Promise<void> {
  const kv = env.AI_USAGE_KV
  if (!kv) return
  try {
    await kv.delete(buildLifetimeUsageKey(userId))
  } catch {
    warn('[AnonCleanup] 删除 LLM lifetime 配额 key 失败', { userId })
  }
  try {
    await kv.delete(buildAnonymousEmbedUsageKey(userId))
  } catch {
    warn('[AnonCleanup] 删除 embed lifetime 配额 key 失败', { userId })
  }
}

function resolveDeps(
  env: Env,
  deps: AnonymousCleanupDeps
): Required<
  Pick<
    AnonymousCleanupDeps,
    | 'listUsersPage'
    | 'deleteUser'
    | 'revokeAllDevices'
    | 'deleteUserMetaKv'
    | 'deleteAnonymousQuotaKeys'
  >
> & { now: Date } {
  let listUsersPage = deps.listUsersPage
  let deleteUser = deps.deleteUser
  if (!listUsersPage || !deleteUser) {
    if (!hasSupabase(env)) {
      throw new Error('supabase_not_configured')
    }
    const admin = createSupabaseClient(env)
    if (!admin) {
      throw new Error('supabase_not_configured')
    }
    if (!listUsersPage) {
      listUsersPage = async (page, perPage) => {
        const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
        return {
          users: (data?.users ?? []) as AnonCleanupUser[],
          error: error ? { message: error.message } : null
        }
      }
    }
    if (!deleteUser) {
      deleteUser = async userId => {
        const { error } = await admin.auth.admin.deleteUser(userId)
        return { error: error ? { message: error.message } : null }
      }
    }
  }
  return {
    listUsersPage,
    deleteUser,
    revokeAllDevices:
      deps.revokeAllDevices ?? ((userId: string) => revokeAllDevicesForUser(env, userId)),
    deleteUserMetaKv: deps.deleteUserMetaKv ?? ((userId: string) => deleteUserMeta(env, userId)),
    deleteAnonymousQuotaKeys:
      deps.deleteAnonymousQuotaKeys ??
      ((userId: string) => defaultDeleteAnonymousQuotaKeys(env, userId)),
    now: deps.now ?? new Date()
  }
}

/**
 * 跑一轮匿名清理。单用户失败记日志继续；整批不因单点失败中断。
 */
export async function runAnonymousCleanup(
  env: Env,
  deps: AnonymousCleanupDeps = {}
): Promise<AnonymousCleanupResult> {
  const dryRun = isAnonCleanupDryRun(env)
  const resolved = resolveDeps(env, deps)
  const now = resolved.now

  let scanned = 0
  let matched = 0
  let deletedOrWouldDelete = 0
  let failed = 0
  let capped = false
  let page = 1

  info('[AnonCleanup] 开始扫描', {
    dryRun,
    retentionDays: 90,
    maxPerRun: ANON_CLEANUP_MAX_PER_RUN,
    now: now.toISOString()
  })

  while (true) {
    const { users, error } = await resolved.listUsersPage(page, ANON_CLEANUP_LIST_PER_PAGE)
    if (error) {
      logErrorMessage('[AnonCleanup] listUsers 失败', {
        page,
        detail: error.message ?? 'unknown'
      })
      break
    }
    if (users.length === 0) break

    for (const user of users) {
      scanned += 1
      if (!isStaleAnonymousUser(user, now)) continue
      matched += 1

      if (deletedOrWouldDelete + failed >= ANON_CLEANUP_MAX_PER_RUN) {
        capped = true
        continue
      }

      if (dryRun) {
        info('[AnonCleanup] 将删除（dry-run）', {
          userId: user.id,
          lastSignInAt: user.last_sign_in_at ?? null,
          createdAt: user.created_at ?? null
        })
        deletedOrWouldDelete += 1
        continue
      }

      try {
        // ① 先 KV：撤 device → ② user_meta → ③ 匿名配额 → ④ deleteUser
        await resolved.revokeAllDevices(user.id)
        await resolved.deleteUserMetaKv(user.id)
        await resolved.deleteAnonymousQuotaKeys(user.id)
        const { error: delErr } = await resolved.deleteUser(user.id)
        if (delErr) {
          failed += 1
          logErrorMessage('[AnonCleanup] deleteUser 失败', {
            userId: user.id,
            detail: delErr.message ?? 'unknown'
          })
          continue
        }
        info('[AnonCleanup] 已删除', { userId: user.id })
        deletedOrWouldDelete += 1
      } catch (err) {
        failed += 1
        logErrorMessage('[AnonCleanup] 单用户清理异常', {
          userId: user.id,
          detail: err instanceof Error ? err.message : String(err)
        })
      }
    }

    if (users.length < ANON_CLEANUP_LIST_PER_PAGE) break
    if (capped) break
    page += 1
  }

  const summary: AnonymousCleanupResult = {
    dryRun,
    scanned,
    matched,
    deletedOrWouldDelete,
    failed,
    capped
  }
  info('[AnonCleanup] 本轮结束', summary)
  return summary
}
