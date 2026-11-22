import { describe, expect, test } from 'bun:test'

import {
  ADMIN_USER_LOOKUP_MAX_PAGES,
  ADMIN_USER_LOOKUP_PER_PAGE,
  AdminUserLookupError,
  findUserByEmail,
  shouldContinueListUsersPage,
  type AdminListUsersClient,
  type AdminLookupUser
} from './admin-user-lookup'

function makeAdmin(
  pages: Array<{
    users: AdminLookupUser[]
    nextPage?: number | null
    lastPage?: number
    error?: { message: string } | null
  }>
): AdminListUsersClient {
  return {
    auth: {
      admin: {
        listUsers: async ({ page = 1 } = {}) => {
          const entry = pages[page - 1]
          if (!entry) {
            return {
              data: { users: [], nextPage: null, lastPage: page - 1 },
              error: null
            }
          }
          if (entry.error) {
            return { data: { users: [] }, error: entry.error }
          }
          return {
            data: {
              users: entry.users,
              nextPage: entry.nextPage ?? null,
              lastPage: entry.lastPage ?? page,
              total: entry.users.length
            },
            error: null
          }
        }
      }
    }
  }
}

describe('shouldContinueListUsersPage', () => {
  test('返回数 < perPage → 停', () => {
    expect(
      shouldContinueListUsersPage(1, 10, ADMIN_USER_LOOKUP_PER_PAGE, {
        nextPage: 2,
        lastPage: 5
      })
    ).toBe(false)
  })

  test('nextPage 为空 → 停', () => {
    expect(
      shouldContinueListUsersPage(1, ADMIN_USER_LOOKUP_PER_PAGE, ADMIN_USER_LOOKUP_PER_PAGE, {
        nextPage: null,
        lastPage: 1
      })
    ).toBe(false)
  })
})

describe('findUserByEmail', () => {
  test('第 1 页命中', async () => {
    const admin = makeAdmin([
      {
        users: [
          { id: 'u1', email: 'other@ex.com' },
          { id: 'u-hit', email: 'Target@Ex.com' }
        ],
        nextPage: null,
        lastPage: 1
      }
    ])
    // 入参已归一化；库内大小写靠 toLowerCase 对齐
    const result = await findUserByEmail(admin, 'target@ex.com')
    expect(result).toEqual({ found: true, userId: 'u-hit' })
  })

  test('第 2 页命中', async () => {
    const page1Users: AdminLookupUser[] = Array.from(
      { length: ADMIN_USER_LOOKUP_PER_PAGE },
      (_, i) => ({
        id: `p1-${i}`,
        email: `p1-${i}@ex.com`
      })
    )
    const admin = makeAdmin([
      {
        users: page1Users,
        nextPage: 2,
        lastPage: 2
      },
      {
        users: [{ id: 'u-p2', email: 'found@ex.com' }],
        nextPage: null,
        lastPage: 2
      }
    ])
    const result = await findUserByEmail(admin, 'found@ex.com')
    expect(result).toEqual({ found: true, userId: 'u-p2' })
  })

  test('多页无匹配 → found false', async () => {
    const page1Users: AdminLookupUser[] = Array.from(
      { length: ADMIN_USER_LOOKUP_PER_PAGE },
      (_, i) => ({
        id: `p1-${i}`,
        email: `p1-${i}@ex.com`
      })
    )
    const admin = makeAdmin([
      { users: page1Users, nextPage: 2, lastPage: 2 },
      {
        users: [{ id: 'u-end', email: 'end@ex.com' }],
        nextPage: null,
        lastPage: 2
      }
    ])
    const result = await findUserByEmail(admin, 'missing@ex.com')
    expect(result).toEqual({ found: false })
  })

  test('超 5 页上限报错', async () => {
    const fullPage: AdminLookupUser[] = Array.from(
      { length: ADMIN_USER_LOOKUP_PER_PAGE },
      (_, i) => ({ id: `x-${i}`, email: `x-${i}@ex.com` })
    )
    const pages = Array.from({ length: ADMIN_USER_LOOKUP_MAX_PAGES + 1 }, (_, i) => ({
      users: fullPage,
      nextPage: i + 2,
      lastPage: ADMIN_USER_LOOKUP_MAX_PAGES + 2
    }))
    const admin = makeAdmin(pages)
    await expect(findUserByEmail(admin, 'never@ex.com')).rejects.toBeInstanceOf(
      AdminUserLookupError
    )
    try {
      await findUserByEmail(admin, 'never@ex.com')
    } catch (err) {
      expect(err).toBeInstanceOf(AdminUserLookupError)
      expect((err as AdminUserLookupError).code).toBe('auth_lookup_page_cap')
    }
  })

  test('listUsers 异常 → auth_lookup_failed', async () => {
    const admin: AdminListUsersClient = {
      auth: {
        admin: {
          listUsers: async () => {
            throw new Error('network')
          }
        }
      }
    }
    await expect(findUserByEmail(admin, 'a@b.co')).rejects.toBeInstanceOf(AdminUserLookupError)
    try {
      await findUserByEmail(admin, 'a@b.co')
    } catch (err) {
      expect((err as AdminUserLookupError).code).toBe('auth_lookup_failed')
    }
  })

  test('listUsers 返回 error → auth_lookup_failed', async () => {
    const admin = makeAdmin([{ users: [], error: { message: 'boom' } }])
    await expect(findUserByEmail(admin, 'a@b.co')).rejects.toBeInstanceOf(AdminUserLookupError)
  })
})
