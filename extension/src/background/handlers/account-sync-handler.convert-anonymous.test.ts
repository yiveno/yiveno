import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getDeviceSessionMock, setDeviceSessionMock, promoteAnonymousViaApiMock } = vi.hoisted(
  () => ({
    getDeviceSessionMock: vi.fn(),
    setDeviceSessionMock: vi.fn(),
    promoteAnonymousViaApiMock: vi.fn()
  })
)

vi.mock('@/infrastructure/identity/device-session-service', () => ({
  getDeviceSession: getDeviceSessionMock,
  setDeviceSession: setDeviceSessionMock,
  clearDeviceSession: vi.fn()
}))

vi.mock('@/infrastructure/auth/promote-anonymous-api-client', () => ({
  promoteAnonymousViaApi: promoteAnonymousViaApiMock
}))

vi.mock('@/infrastructure/logging/flow-log', () => ({
  flowStart: () => 0,
  flowOk: vi.fn(),
  flowFail: vi.fn()
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
  })

  it('成功：翻转 session isAnonymous + email', async () => {
    getDeviceSessionMock.mockResolvedValue(anonSession)
    promoteAnonymousViaApiMock.mockResolvedValue({
      ok: true,
      data: {
        userId: anonSession.userId,
        email: 'new@example.com',
        isAnonymous: false
      }
    })

    const result = await handleConvertAnonymousAccount('new@example.com')
    expect(result).toEqual({
      ok: true,
      email: 'new@example.com',
      userId: anonSession.userId
    })
    expect(setDeviceSessionMock).toHaveBeenCalledWith({
      ...anonSession,
      isAnonymous: false,
      email: 'new@example.com'
    })
  })

  it('邮箱冲突 → AUTH_PROMOTE_EMAIL_CONFLICT', async () => {
    getDeviceSessionMock.mockResolvedValue(anonSession)
    promoteAnonymousViaApiMock.mockResolvedValue({
      ok: false,
      status: 409,
      error: 'email_conflict'
    })
    const result = await handleConvertAnonymousAccount('taken@example.com')
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
    const result = await handleConvertAnonymousAccount('bad')
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
    const result = await handleConvertAnonymousAccount('a@b.com')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errorCode).toBe('AUTH_PROMOTE_FAILED')
  })

  it('非匿名 → AUTH_PROMOTE_NOT_ANONYMOUS', async () => {
    getDeviceSessionMock.mockResolvedValue({ ...anonSession, isAnonymous: false })
    const result = await handleConvertAnonymousAccount('a@b.com')
    expect(result).toEqual({ ok: false, errorCode: 'AUTH_PROMOTE_NOT_ANONYMOUS' })
    expect(promoteAnonymousViaApiMock).not.toHaveBeenCalled()
  })
})
