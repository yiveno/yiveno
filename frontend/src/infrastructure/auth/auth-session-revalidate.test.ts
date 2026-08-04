import { beforeEach, describe, expect, it, vi } from 'vitest'

const { refreshAuthSessionDetailedMock } = vi.hoisted(() => ({
  refreshAuthSessionDetailedMock: vi.fn()
}))

vi.mock('@/infrastructure/auth/extension-oauth', () => ({
  refreshAuthSessionDetailed: refreshAuthSessionDetailedMock
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

  it('refresh 成功返回 valid 并标记校验时间', async () => {
    refreshAuthSessionDetailedMock.mockResolvedValue({
      status: 'ok',
      session: {
        accessToken: 'at2',
        refreshToken: 'rt2',
        userId: '22222222-2222-4222-8222-222222222222'
      }
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

  it('refresh 明确作废返回 invalid', async () => {
    refreshAuthSessionDetailedMock.mockResolvedValue({
      status: 'invalid',
      reason: 'invalid_grant'
    })
    const result = await revalidateAuthSession(
      {
        accessToken: 'at',
        refreshToken: 'rt',
        userId: '22222222-2222-4222-8222-222222222222'
      },
      { force: true }
    )
    expect(result).toEqual({ status: 'invalid', reason: 'invalid_grant' })
  })

  it('网络瞬时失败返回 uncertain 且不标记校验时间', async () => {
    refreshAuthSessionDetailedMock.mockResolvedValue({
      status: 'transient',
      reason: 'Failed to fetch'
    })
    const result = await revalidateAuthSession(
      {
        accessToken: 'at',
        refreshToken: 'rt',
        userId: '22222222-2222-4222-8222-222222222222'
      },
      { force: true }
    )
    expect(result).toEqual({ status: 'uncertain', reason: 'Failed to fetch' })
    expect(chrome.storage.session.set).not.toHaveBeenCalled()
  })

  it('节流窗口内 skipped', async () => {
    await chrome.storage.session.set({ [AUTH_LAST_VALIDATED_AT_KEY]: Date.now() })
    const result = await revalidateAuthSession({
      accessToken: 'at',
      refreshToken: 'rt',
      userId: '22222222-2222-4222-8222-222222222222'
    })
    expect(result).toEqual({ status: 'skipped' })
    expect(refreshAuthSessionDetailedMock).not.toHaveBeenCalled()
  })
})
