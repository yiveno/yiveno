/**
 * embed 配额熔断器：持久化 / 预查 fail-open / 身份变化 / 非 quota 不 trip。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { fetchHostedQuotaMock } = vi.hoisted(() => ({
  fetchHostedQuotaMock: vi.fn()
}))

vi.mock('@/infrastructure/ai/hosted-quota-api-client', () => ({
  fetchHostedQuota: fetchHostedQuotaMock
}))

import {
  clearEmbedQuotaBreaker,
  clearEmbedQuotaBreakerIfIdentityChanged,
  EMBED_QUOTA_BREAKER_STORAGE_KEY,
  embedTokenFingerprint,
  gateWorkerEmbedRequest,
  isEmbedQuotaBreakerOpen,
  isEmbedQuotaBreakerOpenSync,
  isWorkerQuotaEmbedError,
  nextUtcMidnightMs,
  reloadEmbedQuotaCircuitBreakerFromStorageForTests,
  resetEmbedQuotaCircuitBreakerForTests,
  tripEmbedQuotaBreaker,
  tripEmbedQuotaBreakerFromError
} from '@/infrastructure/ai/embed-quota-circuit-breaker'

type StorageMap = Record<string, unknown>

function createChromeStorageMock(initial: StorageMap = {}) {
  const store: StorageMap = { ...initial }
  return {
    storage: {
      local: {
        get: vi.fn(async (keys: string | string[] | Record<string, unknown>) => {
          if (typeof keys === 'string') {
            return { [keys]: store[keys] }
          }
          if (Array.isArray(keys)) {
            return Object.fromEntries(keys.map(key => [key, store[key]]))
          }
          return { ...store, ...keys }
        }),
        set: vi.fn(async (items: StorageMap) => {
          Object.assign(store, items)
        }),
        remove: vi.fn(async (keys: string | string[]) => {
          for (const key of Array.isArray(keys) ? keys : [keys]) {
            delete store[key]
          }
        })
      }
    },
    _store: store
  }
}

const TOKEN_A = 'aaaaaaaaaaaaaaaaTOKEN_A_SUFFIX'
const TOKEN_B = 'bbbbbbbbbbbbbbbbTOKEN_B_SUFFIX'

function hostedQuota(partial: { embedRemaining?: number; tier?: 'anonymous' | 'free' | 'pro' }) {
  return {
    model: '@cf/meta/llama',
    tier: partial.tier ?? 'anonymous',
    used: 0,
    limit: 15,
    remaining: 15,
    dailyUsed: 0,
    dailyLimit: 15,
    dailyRemaining: 15,
    monthKey: partial.tier === 'free' || partial.tier === 'pro' ? '2026-11' : 'lifetime',
    ...(partial.embedRemaining !== undefined
      ? {
          embedUsed: 30 - partial.embedRemaining,
          embedLimit: 30,
          embedRemaining: partial.embedRemaining
        }
      : {})
  }
}

describe('embed-quota-circuit-breaker', () => {
  beforeEach(async () => {
    vi.stubGlobal('chrome', createChromeStorageMock())
    resetEmbedQuotaCircuitBreakerForTests()
    fetchHostedQuotaMock.mockReset()
    // 等 fire-and-forget remove 落定
    await Promise.resolve()
  })

  it('trip 后同步拒绝；写入 storage', async () => {
    const now = Date.UTC(2026, 10, 24, 12, 0, 0)
    tripEmbedQuotaBreaker(TOKEN_A, now)
    expect(isEmbedQuotaBreakerOpenSync(now)).toBe(true)
    expect(await isEmbedQuotaBreakerOpen(now)).toBe(true)

    await Promise.resolve()
    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      [EMBED_QUOTA_BREAKER_STORAGE_KEY]: {
        trippedAtMs: now,
        trippedTokenFingerprint: embedTokenFingerprint(TOKEN_A),
        pausedUntilMs: nextUtcMidnightMs(now)
      }
    })
  })

  it('SW 重启模拟：reload 后仍拒绝', async () => {
    const now = Date.UTC(2026, 10, 24, 12, 0, 0)
    tripEmbedQuotaBreaker(TOKEN_A, now)
    await Promise.resolve()

    await reloadEmbedQuotaCircuitBreakerFromStorageForTests()
    expect(await isEmbedQuotaBreakerOpen(now)).toBe(true)
  })

  it('UTC 午夜过期后放行并惰性清理', async () => {
    const now = Date.UTC(2026, 10, 24, 12, 0, 0)
    tripEmbedQuotaBreaker(TOKEN_A, now)
    const afterMidnight = nextUtcMidnightMs(now)
    expect(await isEmbedQuotaBreakerOpen(afterMidnight)).toBe(false)
    expect(isEmbedQuotaBreakerOpenSync(afterMidnight)).toBe(false)
  })

  it('同身份不清；换身份清', async () => {
    const now = Date.UTC(2026, 10, 24, 12, 0, 0)
    tripEmbedQuotaBreaker(TOKEN_A, now)
    expect(await clearEmbedQuotaBreakerIfIdentityChanged(TOKEN_A)).toBe(false)
    expect(await isEmbedQuotaBreakerOpen(now)).toBe(true)

    expect(await clearEmbedQuotaBreakerIfIdentityChanged(TOKEN_B)).toBe(true)
    expect(await isEmbedQuotaBreakerOpen(now)).toBe(false)
  })

  it('维护 clear 清持久态', async () => {
    const now = Date.UTC(2026, 10, 24, 12, 0, 0)
    tripEmbedQuotaBreaker(TOKEN_A, now)
    await Promise.resolve()
    clearEmbedQuotaBreaker('hosted_quota_remaining')
    await Promise.resolve()
    expect(await isEmbedQuotaBreakerOpen(now)).toBe(false)
    expect(chrome.storage.local.remove).toHaveBeenCalledWith(EMBED_QUOTA_BREAKER_STORAGE_KEY)
  })

  it('非 quota 错误不 trip', () => {
    expect(tripEmbedQuotaBreakerFromError(TOKEN_A, new Error('network_error'))).toBe(false)
    expect(isEmbedQuotaBreakerOpenSync()).toBe(false)
    expect(isWorkerQuotaEmbedError(new Error('quota_exceeded'))).toBe(true)
    expect(isWorkerQuotaEmbedError(new Error('http_429'))).toBe(true)
    expect(isWorkerQuotaEmbedError(new Error('server_error'))).toBe(false)
  })

  it('gate：熔断开 → circuit_open，不调配额', async () => {
    const now = Date.UTC(2026, 10, 24, 12, 0, 0)
    tripEmbedQuotaBreaker(TOKEN_A, now)
    const decision = await gateWorkerEmbedRequest({
      accessToken: TOKEN_A,
      allowNetworkPrecheck: true,
      nowMs: now
    })
    expect(decision).toEqual({ allow: false, reason: 'circuit_open' })
    expect(fetchHostedQuotaMock).not.toHaveBeenCalled()
  })

  it('gate：Omnibox 不联网预查', async () => {
    const decision = await gateWorkerEmbedRequest({
      accessToken: TOKEN_A,
      allowNetworkPrecheck: false
    })
    expect(decision).toEqual({ allow: true })
    expect(fetchHostedQuotaMock).not.toHaveBeenCalled()
  })

  it('gate：embedRemaining=0 → trip + precheck_zero', async () => {
    fetchHostedQuotaMock.mockResolvedValue(hostedQuota({ embedRemaining: 0 }))
    const decision = await gateWorkerEmbedRequest({
      accessToken: TOKEN_A,
      allowNetworkPrecheck: true
    })
    expect(decision).toEqual({ allow: false, reason: 'precheck_zero' })
    expect(isEmbedQuotaBreakerOpenSync()).toBe(true)
  })

  it('gate：embedRemaining 未定义（Free）→ fail-open', async () => {
    fetchHostedQuotaMock.mockResolvedValue(hostedQuota({ tier: 'free' }))
    const decision = await gateWorkerEmbedRequest({
      accessToken: TOKEN_A,
      allowNetworkPrecheck: true
    })
    expect(decision).toEqual({ allow: true })
    expect(isEmbedQuotaBreakerOpenSync()).toBe(false)
  })

  it('gate：配额请求失败 → fail-open', async () => {
    fetchHostedQuotaMock.mockRejectedValue(new Error('network_error'))
    const decision = await gateWorkerEmbedRequest({
      accessToken: TOKEN_A,
      allowNetworkPrecheck: true
    })
    expect(decision).toEqual({ allow: true })
  })

  it('gate：同一 token 快照 5 分钟内只请求一次', async () => {
    fetchHostedQuotaMock.mockResolvedValue(hostedQuota({ embedRemaining: 5 }))
    const now = Date.UTC(2026, 10, 24, 12, 0, 0)
    await gateWorkerEmbedRequest({
      accessToken: TOKEN_A,
      allowNetworkPrecheck: true,
      nowMs: now
    })
    await gateWorkerEmbedRequest({
      accessToken: TOKEN_A,
      allowNetworkPrecheck: true,
      nowMs: now + 60_000
    })
    expect(fetchHostedQuotaMock).toHaveBeenCalledTimes(1)
  })
})
