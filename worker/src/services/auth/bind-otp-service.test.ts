import { describe, expect, test } from 'bun:test'

import type { Env } from '../../types/env'
import {
  BIND_OTP_COOLDOWN_MS,
  BIND_OTP_TTL_SECONDS,
  getBindOtpRecord,
  sha256Hex,
  storeBindOtpRecord,
  type BindOtpKv
} from './bind-otp-codes'
import {
  bindClaimKvKey,
  requestBindCode,
  verifyBindCode,
  type BindOtpServiceDeps
} from './bind-otp-service'
import { AdminUserLookupError } from './admin-user-lookup'

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
    TURNSTILE_SECRET_KEY: 'ts-secret',
    ALIYUN_DM_ACCESS_KEY_ID: 'ak',
    ALIYUN_DM_ACCESS_KEY_SECRET: 'sk',
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role'
  } as unknown as Env
}

function baseDeps(overrides: BindOtpServiceDeps = {}): BindOtpServiceDeps {
  return {
    verifyTurnstile: async () => ({ ok: true }),
    sendMail: async () => ({ ok: true, requestId: 'r', envId: null }),
    generateCode: () => '12345678',
    createClaimToken: () => 'a'.repeat(64),
    ...overrides
  }
}

const userId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const deviceId = 'device-1'

describe('requestBindCode', () => {
  test('invalid_email', async () => {
    const kv = createKvMock()
    const result = await requestBindCode(
      createEnv(kv),
      {
        userId,
        deviceId,
        ip: '1.1.1.1',
        email: 'bad',
        turnstileToken: 't',
        locale: 'zh'
      },
      { ...baseDeps(), kv }
    )
    expect(result).toEqual({ ok: false, status: 400, error: 'invalid_email' })
  })

  test('captcha_required / captcha_failed / captcha_not_configured', async () => {
    const kv = createKvMock()
    const env = createEnv(kv)

    const missing = await requestBindCode(
      env,
      { userId, deviceId, ip: null, email: 'a@b.co', turnstileToken: '', locale: 'zh' },
      {
        ...baseDeps(),
        kv,
        verifyTurnstile: async () => ({ ok: false, reason: 'missing_token' })
      }
    )
    expect(missing).toEqual({ ok: false, status: 400, error: 'captcha_required' })

    const failed = await requestBindCode(
      env,
      { userId, deviceId, ip: null, email: 'a@b.co', turnstileToken: 'x', locale: 'zh' },
      {
        ...baseDeps(),
        kv,
        verifyTurnstile: async () => ({ ok: false, reason: 'verify_failed' })
      }
    )
    expect(failed).toEqual({ ok: false, status: 400, error: 'captcha_failed' })

    const noSecret = await requestBindCode(
      env,
      { userId, deviceId, ip: null, email: 'a@b.co', turnstileToken: 'x', locale: 'zh' },
      {
        ...baseDeps(),
        kv,
        verifyTurnstile: async () => ({ ok: false, reason: 'missing_secret' })
      }
    )
    expect(noSecret).toEqual({ ok: false, status: 503, error: 'captcha_not_configured' })
  })

  test('rate_limited 冷却', async () => {
    const kv = createKvMock()
    const env = createEnv(kv)
    const now = 1_700_000_000_000
    await storeBindOtpRecord(
      env,
      'a@b.co',
      {
        codeHash: await sha256Hex('11111111'),
        attempts: 0,
        createdAt: now - 10_000,
        expiresAt: now + BIND_OTP_TTL_SECONDS * 1000
      },
      kv
    )
    const result = await requestBindCode(
      env,
      { userId, deviceId, ip: '1.1.1.1', email: 'a@b.co', turnstileToken: 't', locale: 'zh' },
      { ...baseDeps(), kv, now: () => now }
    )
    expect(result).toEqual({ ok: false, status: 429, error: 'rate_limited' })
    expect(now - (now - 10_000)).toBeLessThan(BIND_OTP_COOLDOWN_MS)
  })

  test('rate_limited 计数超限', async () => {
    const kv = createKvMock()
    const env = createEnv(kv)
    const emailHash = await sha256Hex('a@b.co')
    // 伪造小时计数已满
    const hourKey = [...kv.store.keys()] // placeholder
    void hourKey
    // 直接写入限流 key：bindrl:email:<hash>:<YYYYMMDDHH>
    const now = new Date('2026-11-22T12:00:00Z')
    const bucket = '2026112212'
    await kv.put(`bindrl:email:${emailHash}:${bucket}`, '5')

    const result = await requestBindCode(
      env,
      { userId, deviceId, ip: '1.1.1.1', email: 'a@b.co', turnstileToken: 't', locale: 'zh' },
      { ...baseDeps(), kv, now: () => now.getTime() }
    )
    expect(result).toEqual({ ok: false, status: 429, error: 'rate_limited' })
  })

  test('email_send_failed 不写 OTP 记录', async () => {
    const kv = createKvMock()
    const env = createEnv(kv)
    const result = await requestBindCode(
      env,
      { userId, deviceId, ip: '1.1.1.1', email: 'a@b.co', turnstileToken: 't', locale: 'zh' },
      {
        ...baseDeps(),
        kv,
        sendMail: async () => ({ ok: false, reason: 'api_error', detail: 'boom' })
      }
    )
    expect(result).toEqual({ ok: false, status: 502, error: 'email_send_failed' })
    expect(await getBindOtpRecord(env, 'a@b.co', kv)).toBeNull()
  })

  test('成功发码；不调 getUserByEmail / findUserByEmail', async () => {
    const kv = createKvMock()
    const env = createEnv(kv)
    let lookupCalls = 0
    const result = await requestBindCode(
      env,
      { userId, deviceId, ip: '1.1.1.1', email: ' A@B.CO ', turnstileToken: 't', locale: 'en' },
      {
        ...baseDeps(),
        kv,
        findUserByEmail: async () => {
          lookupCalls += 1
          return { found: false }
        }
      }
    )
    expect(result).toEqual({ ok: true })
    expect(lookupCalls).toBe(0)
    const record = await getBindOtpRecord(env, 'a@b.co', kv)
    expect(record?.codeHash).toBe(await sha256Hex('12345678'))
  })
})

describe('verifyBindCode', () => {
  async function seedCode(
    env: Env,
    kv: BindOtpKv,
    code: string,
    opts?: { createdAt?: number; attempts?: number; expiresAt?: number }
  ) {
    const now = opts?.createdAt ?? Date.now()
    await storeBindOtpRecord(
      env,
      'a@b.co',
      {
        codeHash: await sha256Hex(code),
        attempts: opts?.attempts ?? 0,
        createdAt: now,
        expiresAt: opts?.expiresAt ?? now + BIND_OTP_TTL_SECONDS * 1000
      },
      kv
    )
  }

  test('code_not_found', async () => {
    const kv = createKvMock()
    const result = await verifyBindCode(
      createEnv(kv),
      { userId, email: 'a@b.co', code: '12345678' },
      { ...baseDeps(), kv, findUserByEmail: async () => ({ found: false }) }
    )
    expect(result).toEqual({ ok: false, status: 400, error: 'code_not_found' })
  })

  test('code_expired 删记录', async () => {
    const kv = createKvMock()
    const env = createEnv(kv)
    const now = 1_700_000_000_000
    await seedCode(env, kv, '12345678', {
      createdAt: now - 700_000,
      expiresAt: now - 1
    })
    const result = await verifyBindCode(
      env,
      { userId, email: 'a@b.co', code: '12345678' },
      {
        ...baseDeps(),
        kv,
        now: () => now,
        findUserByEmail: async () => ({ found: false })
      }
    )
    expect(result).toEqual({ ok: false, status: 400, error: 'code_expired' })
    expect(await getBindOtpRecord(env, 'a@b.co', kv)).toBeNull()
  })

  test('invalid_code 计数 + remainingAttempts', async () => {
    const kv = createKvMock()
    const env = createEnv(kv)
    await seedCode(env, kv, '12345678')
    const result = await verifyBindCode(
      env,
      { userId, email: 'a@b.co', code: '00000000' },
      { ...baseDeps(), kv, findUserByEmail: async () => ({ found: false }) }
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toBe('invalid_code')
    expect(result.remainingAttempts).toBe(4)
    expect((await getBindOtpRecord(env, 'a@b.co', kv))?.attempts).toBe(1)
  })

  test('too_many_attempts', async () => {
    const kv = createKvMock()
    const env = createEnv(kv)
    await seedCode(env, kv, '12345678', { attempts: 4 })
    const result = await verifyBindCode(
      env,
      { userId, email: 'a@b.co', code: '00000000' },
      { ...baseDeps(), kv, findUserByEmail: async () => ({ found: false }) }
    )
    expect(result).toEqual({ ok: false, status: 429, error: 'too_many_attempts' })
    expect(await getBindOtpRecord(env, 'a@b.co', kv)).toBeNull()
  })

  test('成功 promote 分支 + claimToken 字段', async () => {
    const kv = createKvMock()
    const env = createEnv(kv)
    await seedCode(env, kv, '12345678')
    const token = 'b'.repeat(64)
    const result = await verifyBindCode(
      env,
      { userId, email: 'a@b.co', code: '12345678' },
      {
        ...baseDeps(),
        kv,
        createClaimToken: () => token,
        findUserByEmail: async () => ({ found: false })
      }
    )
    expect(result).toEqual({
      ok: true,
      data: { branch: 'promote', claimToken: token }
    })
    expect(await getBindOtpRecord(env, 'a@b.co', kv)).toBeNull()
    const raw = await kv.get(bindClaimKvKey(token))
    expect(raw).toBeTruthy()
    const claim = JSON.parse(raw!) as {
      anonUserId: string
      email: string
      branch: string
      targetUserId?: string
    }
    expect(claim.anonUserId).toBe(userId)
    expect(claim.email).toBe('a@b.co')
    expect(claim.branch).toBe('promote')
    expect(claim.targetUserId).toBeUndefined()
  })

  test('成功 claim 分支 + targetUserId', async () => {
    const kv = createKvMock()
    const env = createEnv(kv)
    await seedCode(env, kv, '12345678')
    const token = 'c'.repeat(64)
    const result = await verifyBindCode(
      env,
      { userId, email: 'a@b.co', code: '12345678' },
      {
        ...baseDeps(),
        kv,
        createClaimToken: () => token,
        findUserByEmail: async () => ({ found: true, userId: 'target-user' })
      }
    )
    expect(result).toEqual({
      ok: true,
      data: { branch: 'claim', claimToken: token }
    })
    const claim = JSON.parse((await kv.get(bindClaimKvKey(token)))!) as {
      branch: string
      targetUserId: string
      anonUserId: string
      email: string
    }
    expect(claim.branch).toBe('claim')
    expect(claim.targetUserId).toBe('target-user')
    expect(claim.anonUserId).toBe(userId)
    expect(claim.email).toBe('a@b.co')
  })

  test('findUserByEmail 超限 / 异常 → auth_lookup_failed', async () => {
    const kv = createKvMock()
    const env = createEnv(kv)
    await seedCode(env, kv, '12345678')
    const capped = await verifyBindCode(
      env,
      { userId, email: 'a@b.co', code: '12345678' },
      {
        ...baseDeps(),
        kv,
        findUserByEmail: async () => {
          throw new AdminUserLookupError('auth_lookup_page_cap', 'cap')
        }
      }
    )
    expect(capped).toEqual({ ok: false, status: 502, error: 'auth_lookup_failed' })

    await seedCode(env, kv, '12345678')
    const boom = await verifyBindCode(
      env,
      { userId, email: 'a@b.co', code: '12345678' },
      {
        ...baseDeps(),
        kv,
        findUserByEmail: async () => {
          throw new Error('unexpected')
        }
      }
    )
    expect(boom).toEqual({ ok: false, status: 502, error: 'auth_lookup_failed' })
  })
})
