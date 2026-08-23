import { beforeEach, describe, expect, it, vi } from 'vitest'

const { refreshAuthSessionDetailedMock, getAuthSessionMock, setAuthSessionMock } = vi.hoisted(
  () => ({
    refreshAuthSessionDetailedMock: vi.fn(),
    getAuthSessionMock: vi.fn(),
    setAuthSessionMock: vi.fn()
  })
)

vi.mock('@/infrastructure/auth/extension-oauth', () => ({
  refreshAuthSessionDetailed: refreshAuthSessionDetailedMock
}))

vi.mock('@/infrastructure/identity/auth-session-service', () => ({
  getAuthSession: getAuthSessionMock,
  setAuthSession: setAuthSessionMock
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

const baseSession = {
  accessToken: 'at',
  refreshToken: 'rt',
  userId: '22222222-2222-4222-8222-222222222222'
}

describe('auth-session-revalidate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getAuthSessionMock.mockResolvedValue(null)
    setAuthSessionMock.mockResolvedValue(undefined)
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
    const result = await revalidateAuthSession(baseSession, { force: true })
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
    const result = await revalidateAuthSession(baseSession, { force: true })
    expect(result).toEqual({ status: 'invalid', reason: 'invalid_grant' })
  })

  it('网络瞬时失败返回 uncertain 且不标记校验时间', async () => {
    refreshAuthSessionDetailedMock.mockResolvedValue({
      status: 'transient',
      reason: 'Failed to fetch'
    })
    const result = await revalidateAuthSession(baseSession, { force: true })
    expect(result).toEqual({ status: 'uncertain', reason: 'Failed to fetch' })
    expect(chrome.storage.session.set).not.toHaveBeenCalled()
  })

  it('Already Used 且存储已轮换 → 采信新 session（valid）', async () => {
    refreshAuthSessionDetailedMock.mockResolvedValue({
      status: 'transient',
      reason: 'Invalid Refresh Token: Already Used'
    })
    getAuthSessionMock.mockResolvedValue({
      accessToken: 'at-new',
      refreshToken: 'rt-new',
      userId: baseSession.userId
    })
    const result = await revalidateAuthSession(baseSession, { force: true })
    expect(result).toEqual({
      status: 'valid',
      session: {
        accessToken: 'at-new',
        refreshToken: 'rt-new',
        userId: baseSession.userId
      }
    })
  })

  it('Already Used 且本地无新 token → invalid（避免假登录）', async () => {
    refreshAuthSessionDetailedMock.mockResolvedValue({
      status: 'transient',
      reason: 'Invalid Refresh Token: Already Used'
    })
    getAuthSessionMock.mockResolvedValue(baseSession)
    const result = await revalidateAuthSession(baseSession, { force: true })
    expect(result).toEqual({
      status: 'invalid',
      reason: 'Invalid Refresh Token: Already Used'
    })
  })

  it('同 refreshToken 并发只打一次 refresh（single-flight）', async () => {
    let resolveRefresh!: (value: unknown) => void
    refreshAuthSessionDetailedMock.mockReturnValue(
      new Promise(resolve => {
        resolveRefresh = resolve
      })
    )
    const p1 = revalidateAuthSession(baseSession, { force: true })
    const p2 = revalidateAuthSession(baseSession, { force: true })
    expect(refreshAuthSessionDetailedMock).toHaveBeenCalledTimes(1)
    resolveRefresh({
      status: 'ok',
      session: { ...baseSession, accessToken: 'at2', refreshToken: 'rt2' }
    })
    const [r1, r2] = await Promise.all([p1, p2])
    expect(r1.status).toBe('valid')
    expect(r2.status).toBe('valid')
    expect(refreshAuthSessionDetailedMock).toHaveBeenCalledTimes(1)
  })

  it('节流窗口内 skipped', async () => {
    await chrome.storage.session.set({ [AUTH_LAST_VALIDATED_AT_KEY]: Date.now() })
    const result = await revalidateAuthSession(baseSession)
    expect(result).toEqual({ status: 'skipped' })
    expect(refreshAuthSessionDetailedMock).not.toHaveBeenCalled()
  })
})
