import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getDeviceSessionMock, getAuthSessionMock, refreshAuthSessionMock, setAuthSessionMock } =
  vi.hoisted(() => ({
    getDeviceSessionMock: vi.fn(),
    getAuthSessionMock: vi.fn(),
    refreshAuthSessionMock: vi.fn(),
    setAuthSessionMock: vi.fn()
  }))

vi.mock('@/infrastructure/identity/device-session-service', () => ({
  getDeviceSession: getDeviceSessionMock
}))

vi.mock('@/infrastructure/identity/auth-session-service', () => ({
  getAuthSession: getAuthSessionMock,
  setAuthSession: setAuthSessionMock
}))

vi.mock('@/infrastructure/auth/extension-oauth', () => ({
  refreshAuthSession: refreshAuthSessionMock
}))

import { getWorkerApiAccessToken } from '@/infrastructure/identity/worker-api-access-token'

describe('getWorkerApiAccessToken', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('优先返回 device token', async () => {
    getDeviceSessionMock.mockResolvedValue({
      deviceToken: 'ydt_device_token_prefer',
      deviceId: '33333333-3333-4333-8333-333333333333',
      userId: '22222222-2222-4222-8222-222222222222',
      isAnonymous: false,
      createdAt: '2026-11-20T08:00:00.000Z'
    })
    getAuthSessionMock.mockResolvedValue({
      accessToken: 'supabase-at',
      refreshToken: 'rt',
      userId: '22222222-2222-4222-8222-222222222222',
      expiresAt: Math.floor(Date.now() / 1000) + 3600
    })
    expect(await getWorkerApiAccessToken()).toBe('ydt_device_token_prefer')
    expect(refreshAuthSessionMock).not.toHaveBeenCalled()
  })

  it('无 device 时回退旧 accessToken', async () => {
    getDeviceSessionMock.mockResolvedValue(null)
    getAuthSessionMock.mockResolvedValue({
      accessToken: 'supabase-at',
      refreshToken: 'rt',
      userId: '22222222-2222-4222-8222-222222222222',
      expiresAt: Math.floor(Date.now() / 1000) + 3600
    })
    expect(await getWorkerApiAccessToken()).toBe('supabase-at')
  })

  it('皆无时返回 null', async () => {
    getDeviceSessionMock.mockResolvedValue(null)
    getAuthSessionMock.mockResolvedValue(null)
    expect(await getWorkerApiAccessToken()).toBeNull()
  })
})
