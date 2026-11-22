import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  setDeviceSessionMock,
  clearAuthSessionMock,
  setAccountBindingMock,
  markAuthValidatedNowMock
} = vi.hoisted(() => ({
  setDeviceSessionMock: vi.fn(),
  clearAuthSessionMock: vi.fn(),
  setAccountBindingMock: vi.fn(),
  markAuthValidatedNowMock: vi.fn()
}))

vi.mock('@/infrastructure/identity/device-session-service', () => ({
  setDeviceSession: setDeviceSessionMock
}))

vi.mock('@/infrastructure/identity/auth-session-service', () => ({
  clearAuthSession: clearAuthSessionMock
}))

vi.mock('@/infrastructure/identity/local-profile-service', () => ({
  setAccountBinding: setAccountBindingMock
}))

vi.mock('@/infrastructure/auth/auth-session-revalidate', () => ({
  markAuthValidatedNow: markAuthValidatedNowMock
}))

import { applyIncomingDeviceSession } from './apply-incoming-device-session'

const session = {
  deviceToken: `ydt_${'b'.repeat(64)}`,
  deviceId: '11111111-1111-4111-8111-111111111111',
  userId: '33333333-3333-4333-8333-333333333333',
  isAnonymous: false,
  email: 'u@example.com',
  createdAt: '2026-11-22T08:00:00.000Z'
}

describe('applyIncomingDeviceSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setDeviceSessionMock.mockResolvedValue(undefined)
    clearAuthSessionMock.mockResolvedValue(undefined)
    setAccountBindingMock.mockResolvedValue(undefined)
    markAuthValidatedNowMock.mockResolvedValue(undefined)
  })

  it('换账号：按序 setDevice → clearAuth → setBinding → markValidated', async () => {
    const order: string[] = []
    setDeviceSessionMock.mockImplementation(async () => {
      order.push('setDevice')
    })
    clearAuthSessionMock.mockImplementation(async () => {
      order.push('clearAuth')
    })
    setAccountBindingMock.mockImplementation(async () => {
      order.push('setBinding')
    })
    markAuthValidatedNowMock.mockImplementation(async () => {
      order.push('markValidated')
    })

    await applyIncomingDeviceSession({
      deviceSession: session,
      bindAccountId: session.userId
    })

    expect(order).toEqual(['setDevice', 'clearAuth', 'setBinding', 'markValidated'])
    expect(setAccountBindingMock).toHaveBeenCalledWith({
      accountId: session.userId,
      boundAt: expect.any(String)
    })
  })

  it('同账号覆盖：不写 binding', async () => {
    await applyIncomingDeviceSession({ deviceSession: session })
    expect(setDeviceSessionMock).toHaveBeenCalledWith(session)
    expect(clearAuthSessionMock).toHaveBeenCalled()
    expect(setAccountBindingMock).not.toHaveBeenCalled()
    expect(markAuthValidatedNowMock).toHaveBeenCalled()
  })
})
