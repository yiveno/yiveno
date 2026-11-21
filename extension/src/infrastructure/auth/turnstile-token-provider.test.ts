import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.stubEnv('VITE_WEBSITE_URL', 'https://yiveno.com')

import {
  clearAnonymousCaptchaRetryNeeded,
  closeStaleTurnstileTabs,
  getTurnstileToken,
  isAnonymousCaptchaRetryNeeded,
  resetTurnstileTokenProviderForTests,
  resolveTurnstileTokenFromUiBridge
} from '@/infrastructure/auth/turnstile-token-provider'

/** 等到 tabs.create 完成且 waiter 已挂上。 */
async function flushTabOpen(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

describe('getTurnstileToken', () => {
  let tabsCreate: ReturnType<typeof vi.fn>
  let tabsRemove: ReturnType<typeof vi.fn>
  let tabsQuery: ReturnType<typeof vi.fn>
  let storageSet: ReturnType<typeof vi.fn>

  beforeEach(() => {
    resetTurnstileTokenProviderForTests()
    tabsCreate = vi.fn(async () => ({ id: 42 }))
    tabsRemove = vi.fn(async () => undefined)
    tabsQuery = vi.fn(async () => [])
    storageSet = vi.fn(async () => undefined)
    vi.stubGlobal('chrome', {
      runtime: { id: 'ext-turnstile-test' },
      tabs: { create: tabsCreate, remove: tabsRemove, query: tabsQuery },
      storage: {
        local: { set: storageSet, get: vi.fn(), remove: vi.fn() },
        session: { set: storageSet, get: vi.fn(), remove: vi.fn() }
      }
    })
  })

  afterEach(() => {
    resetTurnstileTokenProviderForTests()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('收到 token 返回 token 且关 tab；不写 storage', async () => {
    const pending = getTurnstileToken()
    await flushTabOpen()
    expect(tabsCreate).toHaveBeenCalledWith({
      url: 'https://yiveno.com/auth/turnstile?extension_id=ext-turnstile-test',
      active: false
    })
    expect(resolveTurnstileTokenFromUiBridge('tok-abc-123')).toBe(true)
    await expect(pending).resolves.toBe('tok-abc-123')
    expect(tabsRemove).toHaveBeenCalledWith(42)
    expect(storageSet).not.toHaveBeenCalled()
    expect(isAnonymousCaptchaRetryNeeded()).toBe(false)
  })

  it('超时返回 null 且关 tab，标记需前景重试', async () => {
    vi.useFakeTimers()
    const pending = getTurnstileToken()
    await flushTabOpen()
    await vi.advanceTimersByTimeAsync(30_000)
    await expect(pending).resolves.toBeNull()
    expect(tabsRemove).toHaveBeenCalledWith(42)
    expect(isAnonymousCaptchaRetryNeeded()).toBe(true)
  })

  it('并发 single-flight 只开一 tab', async () => {
    const a = getTurnstileToken()
    const b = getTurnstileToken()
    await flushTabOpen()
    expect(tabsCreate).toHaveBeenCalledTimes(1)
    expect(resolveTurnstileTokenFromUiBridge('shared-token')).toBe(true)
    await expect(a).resolves.toBe('shared-token')
    await expect(b).resolves.toBe('shared-token')
  })

  it('前景打开 active:true', async () => {
    const pending = getTurnstileToken({ foreground: true })
    await flushTabOpen()
    expect(tabsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        active: true
      })
    )
    expect(resolveTurnstileTokenFromUiBridge('fg-token')).toBe(true)
    await expect(pending).resolves.toBe('fg-token')
  })

  it('captchaRetryNeeded 时后台跳过开 tab', async () => {
    vi.useFakeTimers()
    const first = getTurnstileToken()
    await flushTabOpen()
    await vi.advanceTimersByTimeAsync(30_000)
    await first
    expect(isAnonymousCaptchaRetryNeeded()).toBe(true)
    tabsCreate.mockClear()
    tabsQuery.mockClear()
    await expect(getTurnstileToken()).resolves.toBeNull()
    expect(tabsCreate).not.toHaveBeenCalled()
    clearAnonymousCaptchaRetryNeeded()
  })

  it('开 tab 前先清扫残留 Turnstile 页', async () => {
    tabsQuery.mockResolvedValueOnce([
      {
        id: 7,
        active: false,
        url: 'https://yiveno.com/auth/turnstile?extension_id=x'
      }
    ])
    const callOrder: string[] = []
    tabsRemove.mockImplementation(async (id: number) => {
      callOrder.push(`remove:${id}`)
    })
    tabsCreate.mockImplementation(async () => {
      callOrder.push('create')
      return { id: 42 }
    })

    const pending = getTurnstileToken()
    await flushTabOpen()
    expect(callOrder).toEqual(['remove:7', 'create'])
    expect(resolveTurnstileTokenFromUiBridge('after-sweep')).toBe(true)
    await expect(pending).resolves.toBe('after-sweep')
  })

  it('清扫跳过 active Turnstile tab', async () => {
    tabsQuery.mockResolvedValueOnce([
      {
        id: 9,
        active: true,
        url: 'https://yiveno.com/auth/turnstile?extension_id=x'
      }
    ])
    await closeStaleTurnstileTabs()
    expect(tabsRemove).not.toHaveBeenCalled()
  })

  it('清扫跳过当前等待中的 tab', async () => {
    const pending = getTurnstileToken()
    await flushTabOpen()
    expect(tabsCreate).toHaveBeenCalledTimes(1)

    tabsQuery.mockResolvedValueOnce([
      {
        id: 42,
        active: false,
        url: 'https://yiveno.com/auth/turnstile?extension_id=ext-turnstile-test'
      },
      {
        id: 99,
        active: false,
        url: 'https://yiveno.com/auth/turnstile?extension_id=old'
      }
    ])
    tabsRemove.mockClear()
    await closeStaleTurnstileTabs()
    expect(tabsRemove).toHaveBeenCalledTimes(1)
    expect(tabsRemove).toHaveBeenCalledWith(99)
    expect(tabsRemove).not.toHaveBeenCalledWith(42)

    expect(resolveTurnstileTokenFromUiBridge('keep-waiting')).toBe(true)
    await expect(pending).resolves.toBe('keep-waiting')
  })

  it('清扫只关 Turnstile 页、放过无关 tab', async () => {
    tabsQuery.mockResolvedValueOnce([
      {
        id: 11,
        active: false,
        url: 'https://yiveno.com/auth/turnstile?extension_id=x'
      },
      {
        id: 12,
        active: false,
        url: 'https://yiveno.com/account'
      }
    ])
    await closeStaleTurnstileTabs()
    expect(tabsRemove).toHaveBeenCalledTimes(1)
    expect(tabsRemove).toHaveBeenCalledWith(11)
  })

  it('tabs.query 失败时仍能开 tab 收 token（fail-open）', async () => {
    tabsQuery.mockRejectedValueOnce(new Error('query failed'))
    const pending = getTurnstileToken()
    await flushTabOpen()
    expect(tabsCreate).toHaveBeenCalledTimes(1)
    expect(resolveTurnstileTokenFromUiBridge('ok-after-query-fail')).toBe(true)
    await expect(pending).resolves.toBe('ok-after-query-fail')
  })
})
