import { describe, expect, mock, test } from 'bun:test'

import type { Env } from '../../types/env'
import type { BindOtpKv } from './bind-otp-codes'
import { putClaimRecord } from './bind-otp-service'
import { claimByOtp } from './claim-by-otp'
import type { DeviceRegisterResult } from './device-register'

function createKvMock(): BindOtpKv & { store: Map<string, string> } {
  const store = new Map<string, string>()
  return {
    store,
    get: async key => store.get(key) ?? null,
    put: async (key, value) => {
      store.set(key, value)
    },
    delete: async key => {
      store.delete(key)
    }
  }
}

function createEnv(kv: BindOtpKv): Env {
  return {
    AI_USAGE_KV: kv as unknown as Env['AI_USAGE_KV'],
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role'
  } as unknown as Env
}

const anonUserId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const targetUserId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
const claimToken = 'e'.repeat(64)

describe('claimByOtp', () => {
  test('成功签发（mock issue + getUserById）', async () => {
    const kv = createKvMock()
    await putClaimRecord(kv, claimToken, {
      anonUserId,
      email: 'taken@ex.com',
      branch: 'claim',
      targetUserId,
      createdAt: Date.now()
    })

    const issueDevice = mock(async (): Promise<DeviceRegisterResult> => ({
      ok: true,
      data: {
        deviceToken: 'ydt_' + 'f'.repeat(64),
        deviceId: 'dev-1',
        userId: targetUserId,
        email: 'taken@ex.com',
        displayName: null,
        avatarUrl: null,
        isAnonymous: false,
        uninstallRevokeToken: null
      }
    }))

    const result = await claimByOtp(
      createEnv(kv),
      { anonUserId, claimToken, deviceLabel: 'Mac', platform: 'macOS' },
      {
        kv,
        getUserById: async () => ({
          data: { user: { id: targetUserId, email: 'taken@ex.com' } },
          error: null
        }),
        issueDevice
      }
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.userId).toBe(targetUserId)
    expect(result.data.deviceId).toBe('dev-1')
    expect(issueDevice).toHaveBeenCalledTimes(1)
    const call = issueDevice.mock.calls[0] as unknown as [
      Env,
      {
        userId: string
        deviceLabel?: string
        platform?: string
        isAnonymous: boolean
      }
    ]
    const issuedArg = call[1]
    expect(issuedArg.userId).toBe(targetUserId)
    expect(issuedArg.deviceLabel).toBe('Mac')
    expect(issuedArg.platform).toBe('macOS')
    expect(issuedArg.isAnonymous).toBe(false)
  })

  test('invalid_claim：token 不存在', async () => {
    const kv = createKvMock()
    const result = await claimByOtp(
      createEnv(kv),
      { anonUserId, claimToken: 'missing' },
      { kv, issueDevice: async () => ({ ok: false, status: 500, error: 'should_not_run' }) }
    )
    expect(result).toEqual({ ok: false, status: 401, error: 'invalid_claim' })
  })

  test('invalid_claim：错 anonUserId', async () => {
    const kv = createKvMock()
    await putClaimRecord(kv, claimToken, {
      anonUserId,
      email: 'taken@ex.com',
      branch: 'claim',
      targetUserId,
      createdAt: Date.now()
    })
    const result = await claimByOtp(createEnv(kv), { anonUserId: 'other-user', claimToken }, { kv })
    expect(result).toEqual({ ok: false, status: 401, error: 'invalid_claim' })
  })

  test('invalid_claim：promote 分支 token', async () => {
    const kv = createKvMock()
    await putClaimRecord(kv, claimToken, {
      anonUserId,
      email: 'new@ex.com',
      branch: 'promote',
      createdAt: Date.now()
    })
    const result = await claimByOtp(createEnv(kv), { anonUserId, claimToken }, { kv })
    expect(result).toEqual({ ok: false, status: 401, error: 'invalid_claim' })
  })

  test('目标用户已删 → 404 claim_user_not_found', async () => {
    const kv = createKvMock()
    await putClaimRecord(kv, claimToken, {
      anonUserId,
      email: 'taken@ex.com',
      branch: 'claim',
      targetUserId,
      createdAt: Date.now()
    })
    const result = await claimByOtp(
      createEnv(kv),
      { anonUserId, claimToken },
      {
        kv,
        getUserById: async () => ({ data: { user: null }, error: { message: 'not found' } }),
        issueDevice: async () => ({ ok: false, status: 500, error: 'should_not_run' })
      }
    )
    expect(result).toEqual({ ok: false, status: 404, error: 'claim_user_not_found' })
  })

  test('device_limit_reached → 403 透传', async () => {
    const kv = createKvMock()
    await putClaimRecord(kv, claimToken, {
      anonUserId,
      email: 'taken@ex.com',
      branch: 'claim',
      targetUserId,
      createdAt: Date.now()
    })
    const result = await claimByOtp(
      createEnv(kv),
      { anonUserId, claimToken },
      {
        kv,
        getUserById: async () => ({
          data: { user: { id: targetUserId } },
          error: null
        }),
        issueDevice: async () => ({
          ok: false,
          status: 403,
          error: 'device_limit_reached'
        })
      }
    )
    expect(result).toEqual({ ok: false, status: 403, error: 'device_limit_reached' })
  })

  test('服务内不删旧 device 记录（KV 无额外 delete 调旧 anon）', async () => {
    const kv = createKvMock()
    await putClaimRecord(kv, claimToken, {
      anonUserId,
      email: 'taken@ex.com',
      branch: 'claim',
      targetUserId,
      createdAt: Date.now()
    })
    // 预埋一条与旧 anon 无关的假 device key，断言不被删
    await kv.put('devtok:ydt_keep', JSON.stringify({ userId: anonUserId, deviceId: 'old' }))

    const deletes: string[] = []
    const wrapped: BindOtpKv = {
      get: key => kv.get(key),
      put: (key, value, opts) => kv.put(key, value, opts),
      delete: async key => {
        deletes.push(key)
        await kv.delete(key)
      }
    }

    await claimByOtp(
      createEnv(wrapped),
      { anonUserId, claimToken },
      {
        kv: wrapped,
        getUserById: async () => ({
          data: { user: { id: targetUserId } },
          error: null
        }),
        issueDevice: async () => ({
          ok: true,
          data: {
            deviceToken: 'ydt_' + '1'.repeat(64),
            deviceId: 'new-dev',
            userId: targetUserId,
            email: 'taken@ex.com',
            displayName: null,
            avatarUrl: null,
            isAnonymous: false,
            uninstallRevokeToken: null
          }
        })
      }
    )

    expect(deletes.every(k => k.startsWith('bindclaim:'))).toBe(true)
    expect(await kv.get('devtok:ydt_keep')).toBeTruthy()
  })
})
