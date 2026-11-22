import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  getDeviceSessionMock,
  setDeviceSessionMock,
  promoteAnonymousViaApiMock,
  claimByOtpApiMock,
  revokeOwnDeviceTokenMock,
  applyIncomingDeviceSessionMock,
  clearAnonExchange401BackoffMock
} = vi.hoisted(() => ({
  getDeviceSessionMock: vi.fn(),
  setDeviceSessionMock: vi.fn(),
  promoteAnonymousViaApiMock: vi.fn(),
  claimByOtpApiMock: vi.fn(),
  revokeOwnDeviceTokenMock: vi.fn(),
  applyIncomingDeviceSessionMock: vi.fn(),
  clearAnonExchange401BackoffMock: vi.fn()
}))

vi.mock('@/infrastructure/identity/device-session-service', () => ({
  getDeviceSession: getDeviceSessionMock,
  setDeviceSession: setDeviceSessionMock,
  clearDeviceSession: vi.fn()
}))

vi.mock('@/infrastructure/auth/promote-anonymous-api-client', () => ({
  promoteAnonymousViaApi: promoteAnonymousViaApiMock
}))

vi.mock('@/infrastructure/auth/bind-otp-api-client', () => ({
  claimByOtpApi: claimByOtpApiMock,
  requestBindCodeApi: vi.fn(),
  verifyBindCodeApi: vi.fn()
}))

vi.mock('@/infrastructure/auth/device-register-api-client', () => ({
  revokeOwnDeviceToken: revokeOwnDeviceTokenMock,
  deviceSessionFromRegisterData: (data: {
    deviceToken: string
    deviceId: string
    userId: string
    isAnonymous: boolean
    email: string | null
  }) => ({
    deviceToken: data.deviceToken,
    deviceId: data.deviceId,
    userId: data.userId,
    isAnonymous: data.isAnonymous,
    createdAt: '2026-11-22T08:00:00.000Z',
    ...(data.email ? { email: data.email } : {})
  })
}))

vi.mock('@/infrastructure/auth/apply-incoming-device-session', () => ({
  applyIncomingDeviceSession: applyIncomingDeviceSessionMock
}))

vi.mock('@/infrastructure/identity/anon-exchange-401-backoff-service', () => ({
  clearAnonExchange401Backoff: clearAnonExchange401BackoffMock
}))

vi.mock('@/infrastructure/logging/flow-log', () => ({
  flowStart: () => 0,
  flowOk: vi.fn(),
  flowFail: vi.fn()
}))

vi.mock('@/infrastructure/logging/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn() }
}))

import { handleConvertAnonymousAccount } from '@/background/handlers/account-sync-handler'

const anonSession = {
  deviceToken: `ydt_${'a'.repeat(64)}`,
  deviceId: '11111111-1111-4111-8111-111111111111',
  userId: '22222222-2222-4222-8222-222222222222',
  isAnonymous: true,
  createdAt: '2026-11-20T08:00:00.000Z'
}

describe('handleConvertAnonymousAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setDeviceSessionMock.mockResolvedValue(undefined)
    applyIncomingDeviceSessionMock.mockResolvedValue(undefined)
    clearAnonExchange401BackoffMock.mockResolvedValue(undefined)
    revokeOwnDeviceTokenMock.mockResolvedValue(true)
  })

  it('promote：翻转 session isAnonymous + email，并传 claimToken', async () => {
    getDeviceSessionMock.mockResolvedValue(anonSession)
    promoteAnonymousViaApiMock.mockResolvedValue({
      ok: true,
      data: {
        userId: anonSession.userId,
        email: 'new@example.com',
        isAnonymous: false
      }
    })

    const result = await handleConvertAnonymousAccount({
      email: 'new@example.com',
      claimToken: 'tok',
      branch: 'promote'
    })
    expect(result).toEqual({
      ok: true,
      email: 'new@example.com',
      userId: anonSession.userId,
      branch: 'promote'
    })
    expect(promoteAnonymousViaApiMock).toHaveBeenCalledWith(
      anonSession.deviceToken,
      'new@example.com',
      'tok'
    )
    expect(setDeviceSessionMock).toHaveBeenCalledWith({
      ...anonSession,
      isAnonymous: false,
      email: 'new@example.com'
    })
    expect(claimByOtpApiMock).not.toHaveBeenCalled()
  })

  it('claim：撤旧 token → applyIncoming → clearBackoff；撤销失败不阻塞', async () => {
    getDeviceSessionMock.mockResolvedValue(anonSession)
    revokeOwnDeviceTokenMock.mockResolvedValue(false)
    const claimData = {
      deviceToken: `ydt_${'b'.repeat(64)}`,
      deviceId: '44444444-4444-4444-8444-444444444444',
      userId: '55555555-5555-4555-8555-555555555555',
      email: 'taken@example.com',
      displayName: null,
      avatarUrl: null,
      isAnonymous: false
    }
    claimByOtpApiMock.mockResolvedValue({ ok: true, data: claimData })

    const order: string[] = []
    revokeOwnDeviceTokenMock.mockImplementation(async () => {
      order.push('revoke')
      return false
    })
    applyIncomingDeviceSessionMock.mockImplementation(async () => {
      order.push('apply')
    })
    clearAnonExchange401BackoffMock.mockImplementation(async () => {
      order.push('clearBackoff')
    })

    const result = await handleConvertAnonymousAccount({
      email: 'taken@example.com',
      claimToken: 'claim-tok',
      branch: 'claim'
    })

    expect(result).toEqual({
      ok: true,
      email: 'taken@example.com',
      userId: claimData.userId,
      branch: 'claim'
    })
    expect(order).toEqual(['revoke', 'apply', 'clearBackoff'])
    expect(revokeOwnDeviceTokenMock).toHaveBeenCalledWith(anonSession.deviceToken)
    expect(applyIncomingDeviceSessionMock).toHaveBeenCalledWith({
      deviceSession: expect.objectContaining({
        userId: claimData.userId,
        deviceToken: claimData.deviceToken,
        isAnonymous: false
      }),
      bindAccountId: claimData.userId
    })
  })

  it('邮箱冲突 → AUTH_PROMOTE_EMAIL_CONFLICT', async () => {
    getDeviceSessionMock.mockResolvedValue(anonSession)
    promoteAnonymousViaApiMock.mockResolvedValue({
      ok: false,
      status: 409,
      error: 'email_conflict'
    })
    const result = await handleConvertAnonymousAccount({
      email: 'taken@example.com',
      claimToken: 'tok',
      branch: 'promote'
    })
    expect(result).toEqual({
      ok: false,
      errorCode: 'AUTH_PROMOTE_EMAIL_CONFLICT',
      error: 'email_conflict'
    })
    expect(setDeviceSessionMock).not.toHaveBeenCalled()
  })

  it('非法邮箱 → AUTH_PROMOTE_INVALID_EMAIL', async () => {
    getDeviceSessionMock.mockResolvedValue(anonSession)
    promoteAnonymousViaApiMock.mockResolvedValue({
      ok: false,
      status: 400,
      error: 'invalid_email'
    })
    const result = await handleConvertAnonymousAccount({
      email: 'bad',
      claimToken: 'tok',
      branch: 'promote'
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errorCode).toBe('AUTH_PROMOTE_INVALID_EMAIL')
  })

  it('网络失败 → AUTH_PROMOTE_FAILED', async () => {
    getDeviceSessionMock.mockResolvedValue(anonSession)
    promoteAnonymousViaApiMock.mockResolvedValue({
      ok: false,
      status: 0,
      error: 'Failed to fetch'
    })
    const result = await handleConvertAnonymousAccount({
      email: 'a@b.com',
      claimToken: 'tok',
      branch: 'promote'
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errorCode).toBe('AUTH_PROMOTE_FAILED')
  })

  it('非匿名 → AUTH_PROMOTE_NOT_ANONYMOUS', async () => {
    getDeviceSessionMock.mockResolvedValue({ ...anonSession, isAnonymous: false })
    const result = await handleConvertAnonymousAccount({
      email: 'a@b.com',
      claimToken: 'tok',
      branch: 'promote'
    })
    expect(result).toEqual({ ok: false, errorCode: 'AUTH_PROMOTE_NOT_ANONYMOUS' })
    expect(promoteAnonymousViaApiMock).not.toHaveBeenCalled()
  })
})
