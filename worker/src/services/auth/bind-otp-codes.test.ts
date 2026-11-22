import { describe, expect, test } from 'bun:test'

import type { Env } from '../../types/env'
import {
  BIND_OTP_TTL_SECONDS,
  deleteBindOtpRecord,
  generateBindOtpCode,
  getBindOtpRecord,
  isValidBindEmail,
  normalizeBindEmail,
  sha256Hex,
  storeBindOtpRecord,
  type BindOtpKv,
  type BindOtpRecord
} from './bind-otp-codes'

function createKvMock(): BindOtpKv & { store: Map<string, string>; lastTtl: number | null } {
  const store = new Map<string, string>()
  let lastTtl: number | null = null
  return {
    store,
    get lastTtl() {
      return lastTtl
    },
    get: async key => store.get(key) ?? null,
    put: async (key, value, options) => {
      store.set(key, value)
      lastTtl = options?.expirationTtl ?? null
    },
    delete: async key => {
      store.delete(key)
    }
  }
}

describe('normalizeBindEmail / isValidBindEmail', () => {
  test('trim + 小写', () => {
    expect(normalizeBindEmail('  Alice@Example.COM ')).toBe('alice@example.com')
  })

  test('合法 / 非法 / 超长', () => {
    expect(isValidBindEmail('a@b.co')).toBe(true)
    expect(isValidBindEmail('not-email')).toBe(false)
    expect(isValidBindEmail(`${'a'.repeat(250)}@b.co`)).toBe(false)
  })
})

describe('generateBindOtpCode / sha256Hex', () => {
  test('8 位数字且首位非零', () => {
    for (let i = 0; i < 20; i += 1) {
      const code = generateBindOtpCode()
      expect(code).toMatch(/^[1-9]\d{7}$/)
    }
  })

  test('哈希一致性', async () => {
    const a = await sha256Hex('12345678')
    const b = await sha256Hex('12345678')
    expect(a).toBe(b)
    expect(a).toMatch(/^[0-9a-f]{64}$/)
    expect(a).not.toBe(await sha256Hex('12345679'))
  })
})

describe('KV 存取删 roundtrip', () => {
  test('store → get → delete；带 expirationTtl 与过期字段', async () => {
    const kv = createKvMock()
    const env = { AI_USAGE_KV: kv } as unknown as Env
    const now = Date.now()
    const record: BindOtpRecord = {
      codeHash: await sha256Hex('87654321'),
      attempts: 0,
      createdAt: now,
      expiresAt: now + BIND_OTP_TTL_SECONDS * 1000
    }
    const put = await storeBindOtpRecord(env, 'user@example.com', record, kv)
    expect(put.ok).toBe(true)
    expect(kv.lastTtl).toBe(BIND_OTP_TTL_SECONDS)

    const got = await getBindOtpRecord(env, 'user@example.com', kv)
    expect(got).toEqual(record)
    expect(got?.expiresAt).toBe(record.expiresAt)

    await deleteBindOtpRecord(env, 'user@example.com', kv)
    expect(await getBindOtpRecord(env, 'user@example.com', kv)).toBeNull()
  })
})
