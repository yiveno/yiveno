import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  getDeviceSessionMock,
  setDeviceSessionMock,
  getAuthSessionMock,
  registerDeviceViaSessionExchangeMock,
  getAccountBindingMock,
  setAccountBindingMock,
  getOrCreateLocalProfileMock,
  remapOwnerIdMock,
  getSupabasePublicConfigMock,
  getPendingAnonymousSessionMock,
  setPendingAnonymousSessionMock,
  clearPendingAnonymousSessionMock,
  refreshAuthSessionDetailedMock
} = vi.hoisted(() => ({
  getDeviceSessionMock: vi.fn(),
  setDeviceSessionMock: vi.fn(),
  getAuthSessionMock: vi.fn(),
  registerDeviceViaSessionExchangeMock: vi.fn(),
  getAccountBindingMock: vi.fn(),
  setAccountBindingMock: vi.fn(),
  getOrCreateLocalProfileMock: vi.fn(),
  remapOwnerIdMock: vi.fn(),
  getSupabasePublicConfigMock: vi.fn(),
  getPendingAnonymousSessionMock: vi.fn(),
  setPendingAnonymousSessionMock: vi.fn(),
  clearPendingAnonymousSessionMock: vi.fn(),
  refreshAuthSessionDetailedMock: vi.fn()
}))

vi.mock('@/infrastructure/identity/device-session-service', () => ({
  getDeviceSession: getDeviceSessionMock,
  setDeviceSession: setDeviceSessionMock
}))

vi.mock('@/infrastructure/identity/auth-session-service', () => ({
  getAuthSession: getAuthSessionMock
}))

vi.mock('@/infrastructure/identity/pending-anonymous-session-service', () => ({
  getPendingAnonymousSession: getPendingAnonymousSessionMock,
  setPendingAnonymousSession: setPendingAnonymousSessionMock,
  clearPendingAnonymousSession: clearPendingAnonymousSessionMock
}))

vi.mock('@/infrastructure/auth/device-register-api-client', () => ({
  registerDeviceViaSessionExchange: registerDeviceViaSessionExchangeMock,
  deviceSessionFromRegisterData: (data: {
    deviceToken: string
    deviceId: string
    userId: string
    email: string | null
    displayName: string | null
    avatarUrl: string | null
    isAnonymous: boolean
  }) => ({
    deviceToken: data.deviceToken,
    deviceId: data.deviceId,
    userId: data.userId,
    isAnonymous: data.isAnonymous,
    createdAt: '2026-11-20T08:00:00.000Z'
  })
}))

vi.mock('@/infrastructure/identity/local-profile-service', () => ({
  getAccountBinding: getAccountBindingMock,
  setAccountBinding: setAccountBindingMock,
  getOrCreateLocalProfile: getOrCreateLocalProfileMock
}))

vi.mock('@/infrastructure/indexeddb/memory-item-repository', () => ({
  memoryItemRepository: { remapOwnerId: remapOwnerIdMock }
}))

vi.mock('@/infrastructure/auth/supabase-client', () => ({
  getSupabasePublicConfig: getSupabasePublicConfigMock
}))

vi.mock('@/infrastructure/auth/extension-oauth', () => ({
  refreshAuthSessionDetailed: refreshAuthSessionDetailedMock
}))

vi.mock('@/infrastructure/logging/flow-log', () => ({
  flowStart: () => 0,
  flowOk: vi.fn(),
  flowFail: vi.fn()
}))

import { PENDING_ANON_EXCHANGE_RETRY_INTERVAL_MS } from '@/core/identity/pending-anonymous-session'
import { ensureAnonymousDeviceSession } from '@/infrastructure/auth/ensure-anonymous-device-session'
import {
  clearAnonymousCaptchaRetryNeeded,
  isAnonymousCaptchaRetryNeeded,
  markAnonymousCaptchaRetryNeeded,
  resetTurnstileTokenProviderForTests
} from '@/infrastructure/auth/turnstile-token-provider'

const userId = '22222222-2222-4222-8222-222222222222'
const deviceId = '33333333-3333-4333-8333-333333333333'
const localProfileId = '11111111-1111-4111-8111-111111111111'

const deviceOk = {
  ok: true as const,
  data: {
    deviceToken: 'ydt_' + 'n'.repeat(64),
    deviceId,
    userId,
    email: null,
    displayName: null,
    avatarUrl: null,
    isAnonymous: true
  }
}

function signupFetchMock(accessToken = 'transient-supabase-at') {
  return vi.fn(async (url: string) => {
    if (String(url).includes('/auth/v1/signup')) {
      return {
        ok: true,
        json: async () => ({
          access_token: accessToken,
          refresh_token: 'transient-rt',
          expires_in: 3600,
          user: { id: userId, is_anonymous: true }
        })
      }
    }
    throw new Error(`unexpected fetch ${url}`)
  })
}

describe('ensureAnonymousDeviceSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetTurnstileTokenProviderForTests()
    getDeviceSessionMock.mockResolvedValue(null)
    getAuthSessionMock.mockResolvedValue(null)
    getPendingAnonymousSessionMock.mockResolvedValue(null)
    setPendingAnonymousSessionMock.mockResolvedValue(undefined)
    clearPendingAnonymousSessionMock.mockResolvedValue(undefined)
    getAccountBindingMock.mockResolvedValue(null)
    getOrCreateLocalProfileMock.mockResolvedValue({
      localProfileId,
      createdAt: '2026-01-01T00:00:00.000Z',
      schemaVersion: 1
    })
    remapOwnerIdMock.mockResolvedValue(0)
    setDeviceSessionMock.mockResolvedValue(undefined)
    setAccountBindingMock.mockResolvedValue(undefined)
    getSupabasePublicConfigMock.mockReturnValue({
      url: 'https://example.supabase.co',
      anonKey: 'anon-key'
    })
    refreshAuthSessionDetailedMock.mockResolvedValue({
      status: 'invalid',
      reason: 'not_used'
    })
  })

  it('captcha 为 null 时 fail-open 未登录，并标记前景重试', async () => {
    const result = await ensureAnonymousDeviceSession({
      getTurnstileToken: async () => null
    })
    expect(result).toEqual({ status: 'failed', error: 'captcha_unavailable' })
    expect(setDeviceSessionMock).not.toHaveBeenCalled()
    expect(registerDeviceViaSessionExchangeMock).not.toHaveBeenCalled()
    expect(isAnonymousCaptchaRetryNeeded()).toBe(true)
  })

  it('exchange 失败时 fail-open、标记重试，并持久化待交换会话', async () => {
    vi.stubGlobal('fetch', signupFetchMock())
    registerDeviceViaSessionExchangeMock.mockResolvedValue({
      ok: false,
      status: 0,
      error: 'Failed to fetch'
    })
    const result = await ensureAnonymousDeviceSession({
      getTurnstileToken: async () => 'captcha-token'
    })
    expect(result).toEqual({ status: 'failed', error: 'Failed to fetch' })
    expect(setDeviceSessionMock).not.toHaveBeenCalled()
    expect(isAnonymousCaptchaRetryNeeded()).toBe(true)
    expect(setPendingAnonymousSessionMock).toHaveBeenCalled()
    const firstWrite = setPendingAnonymousSessionMock.mock.calls[0]?.[0] as {
      accessToken: string
      userId: string
    }
    expect(firstWrite.accessToken).toBe('transient-supabase-at')
    expect(firstWrite.userId).toBe(userId)
    // 失败后 touch lastExchangeAttemptAt
    expect(setPendingAnonymousSessionMock.mock.calls.length).toBeGreaterThanOrEqual(2)
  })

  it('signup 只调一次：两次 exchange 失败复用待交换 token', async () => {
    const fetchMock = signupFetchMock('reuse-at')
    vi.stubGlobal('fetch', fetchMock)
    registerDeviceViaSessionExchangeMock.mockResolvedValue({
      ok: false,
      status: 0,
      error: 'Failed to fetch'
    })

    await ensureAnonymousDeviceSession({ getTurnstileToken: async () => 'captcha' })
    expect(fetchMock).toHaveBeenCalledTimes(1)

    // 第二次：有 pending，且 lastExchange 已过退避窗
    getPendingAnonymousSessionMock.mockResolvedValue({
      accessToken: 'reuse-at',
      refreshToken: 'transient-rt',
      userId,
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      createdAt: new Date().toISOString(),
      lastExchangeAttemptAt: new Date(
        Date.now() - PENDING_ANON_EXCHANGE_RETRY_INTERVAL_MS - 1000
      ).toISOString()
    })

    await ensureAnonymousDeviceSession({ getTurnstileToken: async () => 'captcha' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(registerDeviceViaSessionExchangeMock).toHaveBeenCalledTimes(2)
    expect(registerDeviceViaSessionExchangeMock).toHaveBeenNthCalledWith(2, 'reuse-at')
  })

  it('成功后清待交换会话；legacy 键未被写', async () => {
    const callOrder: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (String(url).includes('/auth/v1/signup')) {
          callOrder.push('signup')
          return {
            ok: true,
            json: async () => ({
              access_token: 'transient-supabase-at',
              refresh_token: 'transient-rt',
              expires_in: 3600,
              user: { id: userId, is_anonymous: true }
            })
          }
        }
        throw new Error(`unexpected fetch ${url}`)
      })
    )
    registerDeviceViaSessionExchangeMock.mockImplementation(async (at: string) => {
      callOrder.push('exchange')
      expect(at).toBe('transient-supabase-at')
      return deviceOk
    })
    setDeviceSessionMock.mockImplementation(async () => {
      callOrder.push('setDevice')
    })

    markAnonymousCaptchaRetryNeeded()
    const result = await ensureAnonymousDeviceSession({
      getTurnstileToken: async () => 'captcha-token',
      onBeforeExchange: () => {
        callOrder.push('beforeExchange')
      },
      onAfterDeviceStored: () => {
        callOrder.push('afterStored')
      }
    })

    expect(result.status).toBe('created')
    expect(isAnonymousCaptchaRetryNeeded()).toBe(false)
    expect(callOrder).toEqual(['signup', 'beforeExchange', 'exchange', 'setDevice', 'afterStored'])
    expect(clearPendingAnonymousSessionMock).toHaveBeenCalled()
    expect(getAuthSessionMock).toHaveBeenCalled()
    expect(setAccountBindingMock).toHaveBeenCalledWith({
      accountId: userId,
      boundAt: expect.any(String)
    })
    expect(remapOwnerIdMock).toHaveBeenCalledWith(localProfileId, userId)
    clearAnonymousCaptchaRetryNeeded()
  })

  it('过期 → refresh 成功 → 用新 token exchange', async () => {
    getPendingAnonymousSessionMock.mockResolvedValue({
      accessToken: 'old-at',
      refreshToken: 'old-rt',
      userId,
      expiresAt: new Date(Date.now() - 120_000).toISOString(),
      createdAt: '2026-11-20T08:00:00.000Z',
      lastExchangeAttemptAt: new Date(
        Date.now() - PENDING_ANON_EXCHANGE_RETRY_INTERVAL_MS - 1000
      ).toISOString()
    })
    refreshAuthSessionDetailedMock.mockResolvedValue({
      status: 'ok',
      session: {
        accessToken: 'new-at',
        refreshToken: 'new-rt',
        userId,
        expiresAt: Math.floor(Date.now() / 1000) + 3600
      }
    })
    registerDeviceViaSessionExchangeMock.mockResolvedValue(deviceOk)

    const result = await ensureAnonymousDeviceSession({
      getTurnstileToken: async () => 'should-not-run'
    })
    expect(result.status).toBe('created')
    expect(refreshAuthSessionDetailedMock).toHaveBeenCalledWith('old-rt')
    expect(registerDeviceViaSessionExchangeMock).toHaveBeenCalledWith('new-at')
    expect(setPendingAnonymousSessionMock).toHaveBeenCalledWith(
      expect.objectContaining({ accessToken: 'new-at', refreshToken: 'new-rt' })
    )
  })

  it('refresh 失败 → 丢弃 + 全新 signup', async () => {
    getPendingAnonymousSessionMock
      .mockResolvedValueOnce({
        accessToken: 'old-at',
        refreshToken: 'old-rt',
        userId,
        expiresAt: new Date(Date.now() - 120_000).toISOString(),
        createdAt: '2026-11-20T08:00:00.000Z',
        lastExchangeAttemptAt: new Date(
          Date.now() - PENDING_ANON_EXCHANGE_RETRY_INTERVAL_MS - 1000
        ).toISOString()
      })
      .mockResolvedValue(null)
    refreshAuthSessionDetailedMock.mockResolvedValue({
      status: 'invalid',
      reason: 'invalid_grant'
    })
    const fetchMock = signupFetchMock('fresh-at')
    vi.stubGlobal('fetch', fetchMock)
    registerDeviceViaSessionExchangeMock.mockResolvedValue(deviceOk)

    const result = await ensureAnonymousDeviceSession({
      getTurnstileToken: async () => 'captcha'
    })
    expect(result.status).toBe('created')
    expect(clearPendingAnonymousSessionMock).toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalled()
    expect(registerDeviceViaSessionExchangeMock).toHaveBeenCalledWith('fresh-at')
  })

  it('exchange 返回 401 auth-invalid → 丢弃 + 同次全新 signup', async () => {
    getPendingAnonymousSessionMock
      .mockResolvedValueOnce({
        accessToken: 'stale-at',
        refreshToken: 'stale-rt',
        userId,
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
        createdAt: '2026-11-20T08:00:00.000Z',
        lastExchangeAttemptAt: new Date(
          Date.now() - PENDING_ANON_EXCHANGE_RETRY_INTERVAL_MS - 1000
        ).toISOString()
      })
      .mockResolvedValue(null)
    registerDeviceViaSessionExchangeMock
      .mockResolvedValueOnce({ ok: false, status: 401, error: 'invalid_token' })
      .mockResolvedValueOnce(deviceOk)
    const fetchMock = signupFetchMock('fresh-after-401')
    vi.stubGlobal('fetch', fetchMock)

    const result = await ensureAnonymousDeviceSession({
      getTurnstileToken: async () => 'captcha'
    })
    expect(result.status).toBe('created')
    expect(clearPendingAnonymousSessionMock).toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalled()
    expect(registerDeviceViaSessionExchangeMock).toHaveBeenNthCalledWith(1, 'stale-at')
    expect(registerDeviceViaSessionExchangeMock).toHaveBeenNthCalledWith(2, 'fresh-after-401')
  })

  it('退避：间隔内第二次调用零 fetch', async () => {
    getPendingAnonymousSessionMock.mockResolvedValue({
      accessToken: 'pending-at',
      refreshToken: 'pending-rt',
      userId,
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      createdAt: '2026-11-20T08:00:00.000Z',
      lastExchangeAttemptAt: new Date().toISOString()
    })
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const result = await ensureAnonymousDeviceSession({
      getTurnstileToken: async () => 'captcha'
    })
    expect(result).toEqual({ status: 'failed', error: 'exchange_backoff' })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(registerDeviceViaSessionExchangeMock).not.toHaveBeenCalled()
  })

  it('手动重试 ignoreBackoff 绕过退避', async () => {
    getPendingAnonymousSessionMock.mockResolvedValue({
      accessToken: 'pending-at',
      refreshToken: 'pending-rt',
      userId,
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      createdAt: '2026-11-20T08:00:00.000Z',
      lastExchangeAttemptAt: new Date().toISOString()
    })
    registerDeviceViaSessionExchangeMock.mockResolvedValue(deviceOk)

    const result = await ensureAnonymousDeviceSession({
      getTurnstileToken: async () => 'should-not-run',
      ignoreBackoff: true
    })
    expect(result.status).toBe('created')
    expect(registerDeviceViaSessionExchangeMock).toHaveBeenCalledWith('pending-at')
  })

  it('已有会话时不重复 signup，并 best-effort 清待交换', async () => {
    const device = {
      deviceToken: 'ydt_' + 'e'.repeat(64),
      deviceId,
      userId,
      isAnonymous: true,
      createdAt: '2026-11-20T08:00:00.000Z'
    }
    getDeviceSessionMock.mockResolvedValue(device)
    const result = await ensureAnonymousDeviceSession({
      getTurnstileToken: async () => 'captcha'
    })
    expect(result).toEqual({ status: 'already', session: device })
    expect(clearPendingAnonymousSessionMock).toHaveBeenCalled()
  })
})
