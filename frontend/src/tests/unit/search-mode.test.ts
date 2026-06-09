import { describe, expect, it } from 'vitest'
import {
  parseIsLoggedInFromAuthStorage,
  parseIsProFromSubscriptionCache,
  resolveSearchStrategyFromSnapshot
} from '@/core/query/search-mode'

describe('search-mode', () => {
  it('Free 或未登录仅使用 fuse', () => {
    expect(
      resolveSearchStrategyFromSnapshot({
        isLoggedIn: false,
        isPro: false,
        semanticSearchEnabled: true
      })
    ).toBe('fuse')

    expect(
      resolveSearchStrategyFromSnapshot({
        isLoggedIn: true,
        isPro: false,
        semanticSearchEnabled: true
      })
    ).toBe('fuse')
  })

  it('Pro 且开启语义检索使用 hybrid', () => {
    expect(
      resolveSearchStrategyFromSnapshot({
        isLoggedIn: true,
        isPro: true,
        semanticSearchEnabled: true
      })
    ).toBe('hybrid')
  })

  it('Pro 关闭语义开关降级为 fuse', () => {
    expect(
      resolveSearchStrategyFromSnapshot({
        isLoggedIn: true,
        isPro: true,
        semanticSearchEnabled: false
      })
    ).toBe('fuse')
  })

  it('parseIsLoggedInFromAuthStorage 识别有效 session', () => {
    expect(
      parseIsLoggedInFromAuthStorage(
        JSON.stringify({ access_token: 'token-abc', refresh_token: 'refresh-abc' })
      )
    ).toBe(true)
    expect(parseIsLoggedInFromAuthStorage('')).toBe(false)
  })

  it('parseIsProFromSubscriptionCache 识别 Pro 订阅', () => {
    expect(
      parseIsProFromSubscriptionCache({
        subscriptionStatus: { tier: 'pro', status: 'active' }
      })
    ).toBe(true)
    expect(
      parseIsProFromSubscriptionCache({
        subscriptionStatus: { tier: 'free', status: 'active' }
      })
    ).toBe(false)
  })
})
