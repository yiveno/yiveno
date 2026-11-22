/**
 * Admin 按邮箱查用户：listUsers 分页扫描（SDK 无 getUserByEmail）。
 * 超 5 页 / Admin 失败 → 抛错，由调用方映射 502 auth_lookup_failed。
 */

import { warn } from '../../utils/logger'
import { maskEmailForLog } from './promote-anonymous-user'

/** listUsers 每页条数（请求侧；是否被服务端截断以响应为准） */
export const ADMIN_USER_LOOKUP_PER_PAGE = 1000

/** 最多扫描页数（× perPage ≈ 5000 用户） */
export const ADMIN_USER_LOOKUP_MAX_PAGES = 5

/** 扫描用最小用户字段 */
export type AdminLookupUser = {
  id: string
  email?: string | null
}

/** listUsers 成功页（对齐 auth-js Pagination：nextPage / lastPage） */
export type AdminListUsersPage = {
  users: AdminLookupUser[]
  nextPage?: number | null
  lastPage?: number
  total?: number
  aud?: string
}

export type AdminListUsersClient = {
  auth: {
    admin: {
      listUsers: (params?: { page?: number; perPage?: number }) => Promise<{
        data: AdminListUsersPage | { users: [] }
        error: { message?: string } | null
      }>
    }
  }
}

export type FindUserByEmailResult = { found: true; userId: string } | { found: false }

/** Admin 查询 / 超页失败（调用方勿透传 message） */
export class AdminUserLookupError extends Error {
  readonly code: 'auth_lookup_failed' | 'auth_lookup_page_cap'

  constructor(code: 'auth_lookup_failed' | 'auth_lookup_page_cap', message: string) {
    super(message)
    this.name = 'AdminUserLookupError'
    this.code = code
  }
}

/**
 * 是否还应继续翻页。
 * 停条件：空页 / 返回数 < perPage / nextPage 为空 / 已到 lastPage。
 */
export function shouldContinueListUsersPage(
  page: number,
  usersLength: number,
  perPage: number,
  pagination: { nextPage?: number | null; lastPage?: number }
): boolean {
  if (usersLength === 0) return false
  if (usersLength < perPage) return false
  if (pagination.nextPage == null) return false
  if (
    typeof pagination.lastPage === 'number' &&
    pagination.lastPage > 0 &&
    page >= pagination.lastPage
  ) {
    return false
  }
  return true
}

/**
 * 用 Admin listUsers 分页扫描匹配邮箱。
 * @param admin 已构造的 service_role 客户端（本函数不新建）
 * @param normalizedEmail 已 trim+小写
 */
export async function findUserByEmail(
  admin: AdminListUsersClient,
  normalizedEmail: string
): Promise<FindUserByEmailResult> {
  const emailMasked = maskEmailForLog(normalizedEmail)
  let pagesScanned = 0

  for (let page = 1; page <= ADMIN_USER_LOOKUP_MAX_PAGES; page += 1) {
    pagesScanned = page
    let data: AdminListUsersPage | { users: [] }
    let error: { message?: string } | null
    try {
      const result = await admin.auth.admin.listUsers({
        page,
        perPage: ADMIN_USER_LOOKUP_PER_PAGE
      })
      data = result.data
      error = result.error
    } catch (err) {
      throw new AdminUserLookupError(
        'auth_lookup_failed',
        err instanceof Error ? err.message : 'listUsers_threw'
      )
    }

    if (error) {
      throw new AdminUserLookupError(
        'auth_lookup_failed',
        error.message?.trim() || 'listUsers_error'
      )
    }

    const users = Array.isArray(data.users) ? data.users : []
    for (const user of users) {
      const email = user.email?.toLowerCase()
      if (email === normalizedEmail && typeof user.id === 'string' && user.id) {
        if (pagesScanned > 1) {
          warn('[Auth] bind 邮箱查找跨页命中', {
            pagesScanned,
            emailMasked
          })
        }
        return { found: true, userId: user.id }
      }
    }

    const pagination = data as AdminListUsersPage
    const hasMore = shouldContinueListUsersPage(
      page,
      users.length,
      ADMIN_USER_LOOKUP_PER_PAGE,
      pagination
    )
    if (!hasMore) {
      if (pagesScanned > 1) {
        warn('[Auth] bind 邮箱查找多页无匹配', {
          pagesScanned,
          emailMasked
        })
      }
      return { found: false }
    }

    if (page === ADMIN_USER_LOOKUP_MAX_PAGES) {
      throw new AdminUserLookupError(
        'auth_lookup_page_cap',
        `exceeded_${ADMIN_USER_LOOKUP_MAX_PAGES}_pages`
      )
    }
  }

  throw new AdminUserLookupError(
    'auth_lookup_page_cap',
    `exceeded_${ADMIN_USER_LOOKUP_MAX_PAGES}_pages`
  )
}
