import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/infrastructure/auth/auth-session-revalidate', () => ({
  AUTH_LAST_VALIDATED_AT_KEY: 'yiveno:auth_last_validated_at',
  AUTH_REVALIDATE_MIN_INTERVAL_MS: 300_000,
  clearAuthValidationTimestamp: vi.fn(),
  markAuthValidatedNow: vi.fn(async () => undefined),
  shouldRevalidateAuthSession: vi.fn(async () => true)
}))

vi.mock('@/infrastructure/logging/flow-log', () => ({
  flowStart: () => 0,
  flowOk: vi.fn(),
  flowFail: vi.fn()
}))

import { revalidateDeviceSession } from '@/infrastructure/auth/device-session-revalidate'

const session = {
  deviceToken: 'ydt_' + 't'.repeat(64),
  deviceId: '33333333-3333-4333-8333-333333333333',
  userId: '22222222-2222-4222-8222-222222222222',
  isAnonymous: false,
  createdAt: '2026-11-20T08:00:00.000Z'
}

describe('revalidateDeviceSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com')
  })

  it('401 → invalid', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 401,
        json: async () => ({ error: 'invalid_token' })
      }))
    )
    const result = await revalidateDeviceSession(session, { force: true })
    expect(result).toEqual({ status: 'invalid', reason: 'device_token_unauthorized' })
  })

  it('非 401 错误 → uncertain', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 503,
        json: async () => ({ error: 'unavailable' })
      }))
    )
    const result = await revalidateDeviceSession(session, { force: true })
    expect(result).toEqual({ status: 'uncertain', reason: 'http_503' })
  })

  it('200 → valid', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: { isPro: false } })
      }))
    )
    const result = await revalidateDeviceSession(session, { force: true })
    expect(result).toEqual({ status: 'valid', session })
  })
})
