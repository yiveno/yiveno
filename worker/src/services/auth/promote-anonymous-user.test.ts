import { describe, expect, test } from 'bun:test'

import type { Env } from '../../types/env'
import {
  getDeviceTokenRecord,
  getUserMeta,
  issueDeviceToken,
  userMetaKvKey
} from './device-token-kv'
import {
  mapPromoteAdminError,
  maskEmailForLog,
  promoteAnonymousUser,
  type PromoteAdminUpdateUser
} from './promote-anonymous-user'

function createKvMock(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial))
  return {
    store,
    get: async (key: string) => store.get(key) ?? null,
    put: async (key: string, value: string) => {
      store.set(key, value)
    },
    delete: async (key: string) => {
      store.delete(key)
    }
  }
}

function createEnv(overrides: Record<string, unknown> = {}): Env {
  return {
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_ANON_KEY: 'anon-key',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
    AI_USAGE_KV: createKvMock() as unknown as Env['AI_USAGE_KV'],
    ...overrides
  } as unknown as Env
}

describe('maskEmailForLog / mapPromoteAdminError', () => {
  test('掩码保留首字符与域名', () => {
    expect(maskEmailForLog('alice@example.com')).toBe('a***@example.com')
  })

  test('email_exists → email_conflict', () => {
    expect(mapPromoteAdminError({ code: 'email_exists' })).toBe('email_conflict')
  })

  test('already been registered → email_conflict', () => {
    expect(
      mapPromoteAdminError({ message: 'A user with this email has already been registered' })
    ).toBe('email_conflict')
  })

  test('其它错误 → promote_failed', () => {
    expect(mapPromoteAdminError({ code: 'unexpected_failure', message: 'boom' })).toBe(
      'promote_failed'
    )
  })
})

describe('promoteAnonymousUser', () => {
  test('非法邮箱 → 400 invalid_email', async () => {
    const result = await promoteAnonymousUser(
      createEnv(),
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'not-an-email'
    )
    expect(result).toEqual({ ok: false, status: 400, error: 'invalid_email' })
  })

  test('成功转正：meta 翻转 + 原 token 仍可读', async () => {
    const env = createEnv()
    const userId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
    const issued = await issueDeviceToken(env, { userId, isAnonymous: true })
    expect(issued.ok).toBe(true)
    if (!issued.ok) return

    const updateUserById: PromoteAdminUpdateUser = async (_uid, attrs) => ({
      data: { user: { id: userId, email: attrs.email } },
      error: null
    })

    const result = await promoteAnonymousUser(env, userId, ' new@example.com ', {
      updateUserById
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data).toEqual({
      userId,
      email: 'new@example.com',
      isAnonymous: false
    })

    const meta = await getUserMeta(env, userId)
    expect(meta?.isAnonymous).toBe(false)
    expect(meta?.email).toBe('new@example.com')

    const record = await getDeviceTokenRecord(env, issued.deviceToken)
    expect(record?.userId).toBe(userId)
    expect(record?.revokedAt).toBeUndefined()
  })

  test('邮箱冲突 → 409 email_conflict', async () => {
    const env = createEnv()
    const userId = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'
    await issueDeviceToken(env, { userId, isAnonymous: true })

    const updateUserById: PromoteAdminUpdateUser = async () => ({
      data: { user: null },
      error: { code: 'email_exists', message: 'already been registered' }
    })

    const result = await promoteAnonymousUser(env, userId, 'taken@example.com', {
      updateUserById
    })
    expect(result).toEqual({ ok: false, status: 409, error: 'email_conflict' })
    const meta = await getUserMeta(env, userId)
    expect(meta?.isAnonymous).toBe(true)
  })

  test('已非匿名 → 200 幂等', async () => {
    const kv = createKvMock({
      [userMetaKvKey('cccccccc-cccc-cccc-cccc-cccccccccccc')]: JSON.stringify({
        isAnonymous: false,
        email: 'free@example.com',
        updatedAt: new Date().toISOString()
      })
    })
    const env = createEnv({ AI_USAGE_KV: kv as unknown as Env['AI_USAGE_KV'] })
    let adminCalled = 0
    const updateUserById: PromoteAdminUpdateUser = async () => {
      adminCalled += 1
      return { data: { user: null }, error: null }
    }
    const result = await promoteAnonymousUser(
      env,
      'cccccccc-cccc-cccc-cccc-cccccccccccc',
      'another@example.com',
      { updateUserById }
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.idempotent).toBe(true)
    expect(result.data.email).toBe('free@example.com')
    expect(adminCalled).toBe(0)
  })
})
