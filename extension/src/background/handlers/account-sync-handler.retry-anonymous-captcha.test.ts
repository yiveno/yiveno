import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  ensureAnonymousDeviceSessionMock,
  getTurnstileTokenMock,
  clearAnonymousCaptchaRetryNeededMock
} = vi.hoisted(() => ({
  ensureAnonymousDeviceSessionMock: vi.fn(),
  getTurnstileTokenMock: vi.fn(),
  clearAnonymousCaptchaRetryNeededMock: vi.fn()
}))

vi.mock('@/infrastructure/auth/ensure-anonymous-device-session', () => ({
  ensureAnonymousDeviceSession: ensureAnonymousDeviceSessionMock
}))

vi.mock('@/infrastructure/auth/turnstile-token-provider', () => ({
  getTurnstileToken: getTurnstileTokenMock,
  isAnonymousCaptchaRetryNeeded: vi.fn(() => true),
  clearAnonymousCaptchaRetryNeeded: clearAnonymousCaptchaRetryNeededMock
}))

vi.mock('@/infrastructure/logging/flow-log', () => ({
  flowStart: () => 0,
  flowOk: vi.fn(),
  flowFail: vi.fn()
}))

import { handleRetryAnonymousCaptcha } from '@/background/handlers/account-sync-handler'

describe('handleRetryAnonymousCaptcha', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getTurnstileTokenMock.mockResolvedValue('fg-token')
  })

  it('注入前景 getTurnstileToken 并复用 ensure', async () => {
    ensureAnonymousDeviceSessionMock.mockImplementation(
      async (deps: { getTurnstileToken: () => Promise<string | null> }) => {
        const token = await deps.getTurnstileToken()
        expect(token).toBe('fg-token')
        expect(getTurnstileTokenMock).toHaveBeenCalledWith({ foreground: true })
        return {
          status: 'created',
          session: {
            deviceToken: 'ydt_x',
            deviceId: '11111111-1111-4111-8111-111111111111',
            userId: '22222222-2222-4222-8222-222222222222',
            isAnonymous: true,
            createdAt: '2026-11-20T08:00:00.000Z'
          }
        }
      }
    )

    const result = await handleRetryAnonymousCaptcha()
    expect(result).toEqual({ ok: true, outcome: 'created' })
    expect(clearAnonymousCaptchaRetryNeededMock).toHaveBeenCalled()
  })

  it('ensure 失败时 ok:true outcome failed（不弹系统错）', async () => {
    ensureAnonymousDeviceSessionMock.mockResolvedValue({
      status: 'failed',
      error: 'captcha_unavailable'
    })
    const result = await handleRetryAnonymousCaptcha()
    expect(result).toEqual({
      ok: true,
      outcome: 'failed',
      error: 'captcha_unavailable'
    })
    expect(clearAnonymousCaptchaRetryNeededMock).not.toHaveBeenCalled()
  })
})
