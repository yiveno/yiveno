import { describe, expect, test } from 'bun:test'

import type { BindOtpKv } from './bind-otp-codes'
import {
  bindClaimKvKey,
  putClaimRecord,
  validateAndConsumeClaimToken,
  type BindClaimRecord
} from './bind-otp-service'

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

const baseRecord = (overrides: Partial<BindClaimRecord> = {}): BindClaimRecord => ({
  anonUserId: 'anon-1',
  email: 'a@b.co',
  branch: 'promote',
  createdAt: Date.now(),
  ...overrides
})

describe('validateAndConsumeClaimToken', () => {
  test('有效消费；删后重放 → invalid_claim', async () => {
    const kv = createKvMock()
    const token = 't'.repeat(64)
    await putClaimRecord(kv, token, baseRecord())
    const first = await validateAndConsumeClaimToken(kv, token, {
      anonUserId: 'anon-1',
      email: 'a@b.co',
      branch: 'promote'
    })
    expect(first.ok).toBe(true)
    if (first.ok) {
      expect(first.record.email).toBe('a@b.co')
    }
    expect(await kv.get(bindClaimKvKey(token))).toBeNull()

    const replay = await validateAndConsumeClaimToken(kv, token, {
      anonUserId: 'anon-1',
      email: 'a@b.co',
      branch: 'promote'
    })
    expect(replay).toEqual({ ok: false, error: 'invalid_claim' })
  })

  test('不存在 → invalid_claim', async () => {
    const kv = createKvMock()
    const result = await validateAndConsumeClaimToken(kv, 'missing', {
      anonUserId: 'anon-1',
      email: 'a@b.co',
      branch: 'promote'
    })
    expect(result).toEqual({ ok: false, error: 'invalid_claim' })
  })

  test('过期（KV 无记录）→ invalid_claim', async () => {
    const kv = createKvMock()
    // TTL 到期后 KV 表现为无记录
    const result = await validateAndConsumeClaimToken(kv, 'expired-token', {
      anonUserId: 'anon-1',
      email: 'a@b.co',
      branch: 'promote'
    })
    expect(result).toEqual({ ok: false, error: 'invalid_claim' })
  })

  test('错 branch → invalid_claim', async () => {
    const kv = createKvMock()
    const token = 'b'.repeat(64)
    await putClaimRecord(kv, token, baseRecord({ branch: 'claim', targetUserId: 'tgt' }))
    const result = await validateAndConsumeClaimToken(kv, token, {
      anonUserId: 'anon-1',
      email: 'a@b.co',
      branch: 'promote'
    })
    expect(result).toEqual({ ok: false, error: 'invalid_claim' })
    // 不符时不消费
    expect(await kv.get(bindClaimKvKey(token))).toBeTruthy()
  })

  test('错 userId → invalid_claim', async () => {
    const kv = createKvMock()
    const token = 'c'.repeat(64)
    await putClaimRecord(kv, token, baseRecord())
    const result = await validateAndConsumeClaimToken(kv, token, {
      anonUserId: 'other-anon',
      email: 'a@b.co',
      branch: 'promote'
    })
    expect(result).toEqual({ ok: false, error: 'invalid_claim' })
  })

  test('错 email → invalid_claim', async () => {
    const kv = createKvMock()
    const token = 'd'.repeat(64)
    await putClaimRecord(kv, token, baseRecord())
    const result = await validateAndConsumeClaimToken(kv, token, {
      anonUserId: 'anon-1',
      email: 'other@b.co',
      branch: 'promote'
    })
    expect(result).toEqual({ ok: false, error: 'invalid_claim' })
  })

  test('空 token → invalid_claim', async () => {
    const kv = createKvMock()
    const result = await validateAndConsumeClaimToken(kv, '  ', {
      anonUserId: 'anon-1',
      email: 'a@b.co',
      branch: 'promote'
    })
    expect(result).toEqual({ ok: false, error: 'invalid_claim' })
  })
})
