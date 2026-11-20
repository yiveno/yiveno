import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  getDeviceSessionMock,
  setDeviceSessionMock,
  getAuthSessionMock,
  clearAuthSessionMock,
  registerDeviceViaSessionExchangeMock,
  clearAuthValidationTimestampMock,
  ensureAuthSessionLeaseAlarmMock
} = vi.hoisted(() => ({
  getDeviceSessionMock: vi.fn(),
  setDeviceSessionMock: vi.fn(),
  getAuthSessionMock: vi.fn(),
  clearAuthSessionMock: vi.fn(),
  registerDeviceViaSessionExchangeMock: vi.fn(),
  clearAuthValidationTimestampMock: vi.fn(),
  ensureAuthSessionLeaseAlarmMock: vi.fn()
}))

vi.mock('@/infrastructure/identity/device-session-service', () => ({
  getDeviceSession: getDeviceSessionMock,
  setDeviceSession: setDeviceSessionMock
}))

vi.mock('@/infrastructure/identity/auth-session-service', () => ({
  getAuthSession: getAuthSessionMock,
  clearAuthSession: clearAuthSessionMock
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
    createdAt: '2026-11-20T08:00:00.000Z',
    ...(data.email ? { email: data.email } : {})
  })
}))

vi.mock('@/infrastructure/auth/auth-session-revalidate', () => ({
  clearAuthValidationTimestamp: clearAuthValidationTimestampMock
}))

vi.mock('@/infrastructure/auth/auth-session-lease-alarm', () => ({
  ensureAuthSessionLeaseAlarm: ensureAuthSessionLeaseAlarmMock
}))

vi.mock('@/infrastructure/logging/flow-log', () => ({
  flowStart: () => 0,
  flowOk: vi.fn(),
  flowFail: vi.fn()
}))

import { migrateAuthSessionToDeviceIfNeeded } from '@/infrastructure/auth/migrate-auth-to-device-session'

const userId = '22222222-2222-4222-8222-222222222222'
const deviceId = '33333333-3333-4333-8333-333333333333'

describe('migrateAuthSessionToDeviceIfNeeded', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setDeviceSessionMock.mockResolvedValue(undefined)
    clearAuthSessionMock.mockResolvedValue(undefined)
    clearAuthValidationTimestampMock.mockResolvedValue(undefined)
    ensureAuthSessionLeaseAlarmMock.mockResolvedValue(undefined)
  })

  it('无旧键时不调用 exchange', async () => {
    getDeviceSessionMock.mockResolvedValue(null)
    getAuthSessionMock.mockResolvedValue(null)
    const result = await migrateAuthSessionToDeviceIfNeeded()
    expect(result).toEqual({ status: 'no_legacy' })
    expect(registerDeviceViaSessionExchangeMock).not.toHaveBeenCalled()
  })

  it('已有 device 不调用 exchange', async () => {
    const device = {
      deviceToken: 'ydt_' + 'x'.repeat(64),
      deviceId,
      userId,
      isAnonymous: false,
      createdAt: '2026-11-20T08:00:00.000Z'
    }
    getDeviceSessionMock.mockResolvedValue(device)
    const result = await migrateAuthSessionToDeviceIfNeeded()
    expect(result).toEqual({ status: 'already_device', session: device })
    expect(registerDeviceViaSessionExchangeMock).not.toHaveBeenCalled()
  })

  it('交换成功：先写新键再删旧键', async () => {
    getDeviceSessionMock.mockResolvedValue(null)
    getAuthSessionMock.mockResolvedValue({
      accessToken: 'legacy-at',
      refreshToken: 'legacy-rt',
      userId
    })
    const order: string[] = []
    setDeviceSessionMock.mockImplementation(async () => {
      order.push('setDevice')
    })
    clearAuthSessionMock.mockImplementation(async () => {
      order.push('clearAuth')
    })
    registerDeviceViaSessionExchangeMock.mockResolvedValue({
      ok: true,
      data: {
        deviceToken: 'ydt_' + 'm'.repeat(64),
        deviceId,
        userId,
        email: null,
        displayName: null,
        avatarUrl: null,
        isAnonymous: false
      }
    })

    const result = await migrateAuthSessionToDeviceIfNeeded()
    expect(result.status).toBe('migrated')
    expect(registerDeviceViaSessionExchangeMock).toHaveBeenCalledWith('legacy-at')
    expect(order).toEqual(['setDevice', 'clearAuth'])
  })

  it('交换失败：保留旧键、不写新键', async () => {
    getDeviceSessionMock.mockResolvedValue(null)
    getAuthSessionMock.mockResolvedValue({
      accessToken: 'legacy-at',
      refreshToken: 'legacy-rt',
      userId
    })
    registerDeviceViaSessionExchangeMock.mockResolvedValue({
      ok: false,
      status: 503,
      error: 'kv_unavailable'
    })

    const result = await migrateAuthSessionToDeviceIfNeeded()
    expect(result).toEqual({ status: 'failed', error: 'kv_unavailable' })
    expect(setDeviceSessionMock).not.toHaveBeenCalled()
    expect(clearAuthSessionMock).not.toHaveBeenCalled()
  })
})
