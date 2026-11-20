import { describe, expect, mock, test } from 'bun:test'

import type { Env } from '../../types/env'
import {
  ANON_CLEANUP_MAX_PER_RUN,
  isAnonCleanupDryRun,
  isStaleAnonymousUser,
  runAnonymousCleanup,
  type AnonCleanupUser
} from './anonymous-cleanup'

const NOW = new Date('2026-11-20T12:00:00.000Z')
const DAY_MS = 24 * 60 * 60 * 1000

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * DAY_MS).toISOString()
}

function user(partial: Partial<AnonCleanupUser> & { id: string }): AnonCleanupUser {
  return {
    is_anonymous: true,
    created_at: daysAgo(100),
    last_sign_in_at: daysAgo(100),
    ...partial
  }
}

describe('isStaleAnonymousUser', () => {
  test('匿名 + last_sign_in 超 90 天 → 入选', () => {
    expect(
      isStaleAnonymousUser(
        user({ id: 'a', last_sign_in_at: daysAgo(91), created_at: daysAgo(200) }),
        NOW
      )
    ).toBe(true)
  })

  test('匿名 + last_sign_in 活跃 → 排除', () => {
    expect(
      isStaleAnonymousUser(
        user({ id: 'a', last_sign_in_at: daysAgo(30), created_at: daysAgo(200) }),
        NOW
      )
    ).toBe(false)
  })

  test('已转正 is_anonymous=false → 排除', () => {
    expect(
      isStaleAnonymousUser(
        user({
          id: 'a',
          is_anonymous: false,
          last_sign_in_at: daysAgo(200),
          created_at: daysAgo(200)
        }),
        NOW
      )
    ).toBe(false)
  })

  test('从未登录 + created 超 90 天 → 入选', () => {
    expect(
      isStaleAnonymousUser(user({ id: 'a', last_sign_in_at: null, created_at: daysAgo(91) }), NOW)
    ).toBe(true)
  })

  test('从未登录 + created 未超期 → 排除', () => {
    expect(
      isStaleAnonymousUser(user({ id: 'a', last_sign_in_at: null, created_at: daysAgo(10) }), NOW)
    ).toBe(false)
  })
})

describe('isAnonCleanupDryRun', () => {
  test('未设 → dry-run', () => {
    expect(isAnonCleanupDryRun({} as Env)).toBe(true)
  })

  test("显式 'false' → 真删", () => {
    expect(isAnonCleanupDryRun({ ANON_CLEANUP_DRY_RUN: 'false' } as Env)).toBe(false)
  })
})

describe('runAnonymousCleanup', () => {
  test('dry-run 不调 deleteUser 且不动 KV', async () => {
    const deleteUser = mock(() => Promise.resolve({ error: null }))
    const revokeAllDevices = mock(() => Promise.resolve())
    const deleteUserMetaKv = mock(() => Promise.resolve())
    const deleteAnonymousQuotaKeys = mock(() => Promise.resolve())
    const stale = user({ id: 'stale-1', last_sign_in_at: daysAgo(100) })

    const result = await runAnonymousCleanup({} as Env, {
      listUsersPage: async page =>
        page === 1 ? { users: [stale], error: null } : { users: [], error: null },
      deleteUser,
      revokeAllDevices,
      deleteUserMetaKv,
      deleteAnonymousQuotaKeys,
      now: NOW
    })

    expect(result.dryRun).toBe(true)
    expect(result.scanned).toBe(1)
    expect(result.matched).toBe(1)
    expect(result.deletedOrWouldDelete).toBe(1)
    expect(result.failed).toBe(0)
    expect(deleteUser).not.toHaveBeenCalled()
    expect(revokeAllDevices).not.toHaveBeenCalled()
    expect(deleteUserMetaKv).not.toHaveBeenCalled()
    expect(deleteAnonymousQuotaKeys).not.toHaveBeenCalled()
  })

  test('真删顺序：先 KV（device → meta → quota）再 deleteUser', async () => {
    const order: string[] = []
    const stale = user({ id: 'stale-2', last_sign_in_at: daysAgo(100) })

    const result = await runAnonymousCleanup({ ANON_CLEANUP_DRY_RUN: 'false' } as Env, {
      listUsersPage: async page =>
        page === 1 ? { users: [stale], error: null } : { users: [], error: null },
      deleteUser: async () => {
        order.push('deleteUser')
        return { error: null }
      },
      revokeAllDevices: async () => {
        order.push('revoke')
      },
      deleteUserMetaKv: async () => {
        order.push('meta')
      },
      deleteAnonymousQuotaKeys: async () => {
        order.push('quota')
      },
      now: NOW
    })

    expect(result.dryRun).toBe(false)
    expect(result.deletedOrWouldDelete).toBe(1)
    expect(order).toEqual(['revoke', 'meta', 'quota', 'deleteUser'])
  })

  test('单用户失败不中断后续', async () => {
    const users = [
      user({ id: 'fail-me', last_sign_in_at: daysAgo(100) }),
      user({ id: 'ok-me', last_sign_in_at: daysAgo(100) })
    ]
    const deleted: string[] = []

    const result = await runAnonymousCleanup({ ANON_CLEANUP_DRY_RUN: 'false' } as Env, {
      listUsersPage: async page =>
        page === 1 ? { users, error: null } : { users: [], error: null },
      deleteUser: async userId => {
        if (userId === 'fail-me') {
          return { error: { message: 'boom' } }
        }
        deleted.push(userId)
        return { error: null }
      },
      revokeAllDevices: async () => {},
      deleteUserMetaKv: async () => {},
      deleteAnonymousQuotaKeys: async () => {},
      now: NOW
    })

    expect(result.failed).toBe(1)
    expect(result.deletedOrWouldDelete).toBe(1)
    expect(deleted).toEqual(['ok-me'])
  })

  test('500 上限：超出截断并 capped', async () => {
    const users: AnonCleanupUser[] = Array.from({ length: ANON_CLEANUP_MAX_PER_RUN + 3 }, (_, i) =>
      user({ id: `u-${i}`, last_sign_in_at: daysAgo(100) })
    )
    let deleteCalls = 0

    const result = await runAnonymousCleanup({} as Env, {
      listUsersPage: async page =>
        page === 1 ? { users, error: null } : { users: [], error: null },
      deleteUser: async () => {
        deleteCalls += 1
        return { error: null }
      },
      revokeAllDevices: async () => {},
      deleteUserMetaKv: async () => {},
      deleteAnonymousQuotaKeys: async () => {},
      now: NOW
    })

    expect(result.dryRun).toBe(true)
    expect(result.deletedOrWouldDelete).toBe(ANON_CLEANUP_MAX_PER_RUN)
    expect(result.matched).toBeGreaterThanOrEqual(ANON_CLEANUP_MAX_PER_RUN)
    expect(result.capped).toBe(true)
    expect(deleteCalls).toBe(0)
  })

  test('筛选取消：活跃匿名与已转正不进删除集', async () => {
    const users = [
      user({ id: 'active', last_sign_in_at: daysAgo(1) }),
      user({ id: 'promoted', is_anonymous: false, last_sign_in_at: daysAgo(200) }),
      user({ id: 'stale', last_sign_in_at: daysAgo(100) })
    ]

    const result = await runAnonymousCleanup({} as Env, {
      listUsersPage: async page =>
        page === 1 ? { users, error: null } : { users: [], error: null },
      deleteUser: async () => ({ error: null }),
      revokeAllDevices: async () => {},
      deleteUserMetaKv: async () => {},
      deleteAnonymousQuotaKeys: async () => {},
      now: NOW
    })

    expect(result.scanned).toBe(3)
    expect(result.matched).toBe(1)
    expect(result.deletedOrWouldDelete).toBe(1)
  })
})
