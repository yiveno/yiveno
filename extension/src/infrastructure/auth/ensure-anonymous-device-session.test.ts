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
  getSupabasePublicConfigMock
} = vi.hoisted(() => ({
  getDeviceSessionMock: vi.fn(),
  setDeviceSessionMock: vi.fn(),
  getAuthSessionMock: vi.fn(),
  registerDeviceViaSessionExchangeMock: vi.fn(),
  getAccountBindingMock: vi.fn(),
  setAccountBindingMock: vi.fn(),
  getOrCreateLocalProfileMock: vi.fn(),
  remapOwnerIdMock: vi.fn(),
  getSupabasePublicConfigMock: vi.fn()
}))

vi.mock('@/infrastructure/identity/device-session-service', () => ({
  getDeviceSession: getDeviceSessionMock,
  setDeviceSession: setDeviceSessionMock
}))

vi.mock('@/infrastructure/identity/auth-session-service', () => ({
  getAuthSession: getAuthSessionMock
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

vi.mock('@/infrastructure/logging/flow-log', () => ({
  flowStart: () => 0,
  flowOk: vi.fn(),
  flowFail: vi.fn()
}))

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

describe('ensureAnonymousDeviceSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetTurnstileTokenProviderForTests()
    getDeviceSessionMock.mockResolvedValue(null)
    getAuthSessionMock.mockResolvedValue(null)
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

  it('exchange 失败时 fail-open 并标记前景重试', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (String(url).includes('/auth/v1/signup')) {
          return {
            ok: true,
            json: async () => ({
              access_token: 'transient-supabase-at',
              user: { id: userId, is_anonymous: true }
            })
          }
        }
        throw new Error(`unexpected fetch ${url}`)
      })
    )
    registerDeviceViaSessionExchangeMock.mockResolvedValue({
      ok: false,
      error: 'Failed to fetch'
    })
    const result = await ensureAnonymousDeviceSession({
      getTurnstileToken: async () => 'captcha-token'
    })
    expect(result).toEqual({ status: 'failed', error: 'Failed to fetch' })
    expect(setDeviceSessionMock).not.toHaveBeenCalled()
    expect(isAnonymousCaptchaRetryNeeded()).toBe(true)
  })

  it('已有会话时不重复 signup', async () => {
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
  })

  it('signup → exchange → 存 token；Supabase 不持久化；exchange 前无 AI', async () => {
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
      return {
        ok: true,
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
    })
    setDeviceSessionMock.mockImplementation(async () => {
      callOrder.push('setDevice')
    })

    markAnonymousCaptchaRetryNeeded()
    expect(isAnonymousCaptchaRetryNeeded()).toBe(true)

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
    clearAnonymousCaptchaRetryNeeded()
    // 未写 auth_session：本测试未 mock setAuthSession；getAuthSession 仍 null
    expect(getAuthSessionMock).toHaveBeenCalled()
    expect(setAccountBindingMock).toHaveBeenCalledWith({
      accountId: userId,
      boundAt: expect.any(String)
    })
    expect(remapOwnerIdMock).toHaveBeenCalledWith(localProfileId, userId)
  })
})
