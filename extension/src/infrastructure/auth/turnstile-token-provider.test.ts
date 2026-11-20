import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.stubEnv('VITE_WEBSITE_URL', 'https://yiveno.com')

import {
  clearAnonymousCaptchaRetryNeeded,
  getTurnstileToken,
  isAnonymousCaptchaRetryNeeded,
  resetTurnstileTokenProviderForTests,
  resolveTurnstileTokenFromUiBridge
} from '@/infrastructure/auth/turnstile-token-provider'

/** 等到 tabs.create 完成且 waiter 已挂上。 */
async function flushTabOpen(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

describe('getTurnstileToken', () => {
  let tabsCreate: ReturnType<typeof vi.fn>
  let tabsRemove: ReturnType<typeof vi.fn>
  let storageSet: ReturnType<typeof vi.fn>

  beforeEach(() => {
    resetTurnstileTokenProviderForTests()
    tabsCreate = vi.fn(async () => ({ id: 42 }))
    tabsRemove = vi.fn(async () => undefined)
    storageSet = vi.fn(async () => undefined)
    vi.stubGlobal('chrome', {
      runtime: { id: 'ext-turnstile-test' },
      tabs: { create: tabsCreate, remove: tabsRemove },
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
    await expect(getTurnstileToken()).resolves.toBeNull()
    expect(tabsCreate).not.toHaveBeenCalled()
    clearAnonymousCaptchaRetryNeeded()
  })
})
