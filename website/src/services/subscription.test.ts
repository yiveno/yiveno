import { describe, expect, it, vi, afterEach } from 'vitest'

import { isActiveProSnapshot, loadUserSubscription } from './subscription'

describe('loadUserSubscription', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('401 返回 error，不是 ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 401,
        json: async () => ({ error: 'missing_authorization' })
      }))
    )
    const result = await loadUserSubscription('token')
    expect(result).toEqual({ status: 'error', errorCode: 'missing_authorization' })
  })

  it('200 pro 返回 ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          tier: 'pro',
          status: 'active',
          currentPeriodEnd: '2026-09-17T00:00:00.000Z'
        })
      }))
    )
    const result = await loadUserSubscription('token')
    expect(result.status).toBe('ok')
    if (result.status === 'ok') {
      expect(result.isPro).toBe(true)
      expect(isActiveProSnapshot(result.subscription)).toBe(true)
    }
  })

  it('200 free 返回 confirmed free', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ tier: 'free', status: 'inactive' })
      }))
    )
    const result = await loadUserSubscription('token')
    expect(result).toEqual({
      status: 'ok',
      subscription: { tier: 'free', status: 'inactive' },
      isPro: false
    })
  })
})
