import { beforeEach, describe, expect, it, vi } from 'vitest'

const { refreshAuthSessionMock } = vi.hoisted(() => ({
  refreshAuthSessionMock: vi.fn()
}))

vi.mock('@/infrastructure/auth/extension-oauth', () => ({
  refreshAuthSession: refreshAuthSessionMock
}))

vi.mock('@/infrastructure/logging/flow-log', () => ({
  flowStart: () => 0,
  flowOk: vi.fn(),
  flowFail: vi.fn()
}))

import {
  AUTH_LAST_VALIDATED_AT_KEY,
  revalidateAuthSession,
  shouldRevalidateAuthSession
} from '@/infrastructure/auth/auth-session-revalidate'

describe('auth-session-revalidate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const sessionStore: Record<string, unknown> = {}
    vi.stubGlobal('chrome', {
      storage: {
        session: {
          get: vi.fn(async (key: string) => ({ [key]: sessionStore[key] })),
          set: vi.fn(async (items: Record<string, unknown>) => {
            Object.assign(sessionStore, items)
          }),
          remove: vi.fn(async (key: string) => {
            delete sessionStore[key]
          })
        }
      }
    })
  })

  it('无时间戳时应校验', async () => {
    await expect(shouldRevalidateAuthSession()).resolves.toBe(true)
  })

  it('refresh 成功返回 valid', async () => {
    refreshAuthSessionMock.mockResolvedValue({
      accessToken: 'at2',
      refreshToken: 'rt2',
      userId: '22222222-2222-4222-8222-222222222222'
    })
    const result = await revalidateAuthSession(
      {
        accessToken: 'at',
        refreshToken: 'rt',
        userId: '22222222-2222-4222-8222-222222222222'
      },
      { force: true }
    )
    expect(result.status).toBe('valid')
    expect(chrome.storage.session.set).toHaveBeenCalledWith(
      expect.objectContaining({ [AUTH_LAST_VALIDATED_AT_KEY]: expect.any(Number) })
    )
  })

  it('refresh 失败返回 invalid', async () => {
    refreshAuthSessionMock.mockResolvedValue(null)
    const result = await revalidateAuthSession(
      {
        accessToken: 'at',
        refreshToken: 'rt',
        userId: '22222222-2222-4222-8222-222222222222'
      },
      { force: true }
    )
    expect(result).toEqual({ status: 'invalid' })
  })

  it('节流窗口内 skipped', async () => {
    await chrome.storage.session.set({ [AUTH_LAST_VALIDATED_AT_KEY]: Date.now() })
    const result = await revalidateAuthSession({
      accessToken: 'at',
      refreshToken: 'rt',
      userId: '22222222-2222-4222-8222-222222222222'
    })
    expect(result).toEqual({ status: 'skipped' })
    expect(refreshAuthSessionMock).not.toHaveBeenCalled()
  })
})
