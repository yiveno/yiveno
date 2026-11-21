import { beforeEach, describe, expect, it, vi } from 'vitest'

const ensureBackgroundBootstrappedMock = vi.hoisted(() => vi.fn(async () => undefined))

vi.mock('@/background/bootstrap-ready', () => ({
  ensureBackgroundBootstrapped: ensureBackgroundBootstrappedMock
}))

vi.mock('@/application/memory/ensure-memory-embedding-maintenance', () => ({
  scheduleSilentMemoryEmbeddingMaintenance: vi.fn()
}))

import {
  applyExternalAuthDeviceHandoff,
  applyExternalAuthHandoff,
  isExternalAuthHandoffListenerRegistered,
  registerExternalAuthHandoffListener,
  resetExternalAuthHandoffListenerForTests
} from '@/background/listeners/external-auth-handoff'
import { scheduleSilentMemoryEmbeddingMaintenance } from '@/application/memory/ensure-memory-embedding-maintenance'
import { DEVICE_SESSION_STORAGE_KEY } from '@/core/identity/device-session'
import { ANON_EXCHANGE_401_BACKOFF_STORAGE_KEY } from '@/core/identity/pending-anonymous-session'
import { ACCOUNT_BINDING_STORAGE_KEY } from '@/core/identity/local-profile'

type StorageMap = Record<string, unknown>

const USER_A = '22222222-2222-4222-8222-222222222222'
const USER_B = '33333333-3333-4333-8333-333333333333'
const DEVICE_A = '44444444-4444-4444-8444-444444444444'
const DEVICE_B = '55555555-5555-4555-8555-555555555555'

function devicePayload(overrides: Record<string, unknown> = {}) {
  return {
    type: 'YIVENO_AUTH_DEVICE_HANDOFF' as const,
    payload: {
      deviceToken: 'ydt_' + 'a'.repeat(64),
      deviceId: DEVICE_A,
      userId: USER_A,
      isAnonymous: false,
      email: 'u@example.com',
      displayName: 'User',
      ...overrides
    }
  }
}

function createChromeStorageMock(initial: StorageMap = {}) {
  const store: StorageMap = { ...initial }
  const local = {
    get: vi.fn(async (keys: string | string[] | Record<string, unknown>) => {
      if (typeof keys === 'string') {
        return { [keys]: store[keys] }
      }
      if (Array.isArray(keys)) {
        return Object.fromEntries(keys.map(key => [key, store[key]]))
      }
      return { ...store, ...keys }
    }),
    set: vi.fn(async (items: StorageMap) => {
      Object.assign(store, items)
    }),
    remove: vi.fn(async (keys: string | string[]) => {
      for (const key of Array.isArray(keys) ? keys : [keys]) {
        delete store[key]
      }
    })
  }
  const session = {
    get: vi.fn(async () => ({})),
    set: vi.fn(async () => undefined),
    remove: vi.fn(async () => undefined)
  }
  return {
    storage: { local, session },
    runtime: {
      setUninstallURL: vi.fn((_url: string, cb?: () => void) => {
        cb?.()
      }),
      onMessageExternal: {
        addListener: vi.fn()
      },
      lastError: undefined as { message?: string } | undefined
    },
    store
  }
}

describe('external auth handoff（device）', () => {
  beforeEach(() => {
    resetExternalAuthHandoffListenerForTests()
    ensureBackgroundBootstrappedMock.mockClear()
    vi.mocked(scheduleSilentMemoryEmbeddingMaintenance).mockClear()
    vi.stubGlobal('chrome', createChromeStorageMock())
  })

  it('合法 device handoff 写入 device session 与 AccountBinding，不静默 absorb', async () => {
    const result = await applyExternalAuthDeviceHandoff(devicePayload())
    expect(result).toEqual({ ok: true })

    const setCalls = vi.mocked(chrome.storage.local.set).mock.calls
    const flattened = Object.assign({}, ...setCalls.map(call => call[0] as StorageMap))
    expect(flattened[DEVICE_SESSION_STORAGE_KEY]).toMatchObject({
      userId: USER_A,
      deviceId: DEVICE_A,
      isAnonymous: false
    })
    expect(flattened[DEVICE_SESSION_STORAGE_KEY]).toHaveProperty('createdAt')
    expect(flattened[ACCOUNT_BINDING_STORAGE_KEY]).toMatchObject({
      accountId: USER_A
    })
    await vi.waitFor(() => {
      expect(ensureBackgroundBootstrappedMock).toHaveBeenCalled()
      expect(scheduleSilentMemoryEmbeddingMaintenance).toHaveBeenCalledWith('auth_handoff', 800)
    })
  })

  it('载荷非法 → 拒绝', async () => {
    const result = await applyExternalAuthDeviceHandoff({
      type: 'YIVENO_AUTH_DEVICE_HANDOFF',
      payload: { deviceToken: 'short', userId: 'not-uuid' }
    })
    expect(result).toEqual({ ok: false, error: 'invalid_handoff_payload' })
    expect(chrome.storage.local.set).not.toHaveBeenCalled()
  })

  it('同账号重复 Connect：覆盖 token，不重写 binding，不调度 embedding', async () => {
    vi.stubGlobal(
      'chrome',
      createChromeStorageMock({
        [DEVICE_SESSION_STORAGE_KEY]: {
          deviceToken: 'ydt_' + 'b'.repeat(64),
          deviceId: DEVICE_B,
          userId: USER_A,
          isAnonymous: false,
          createdAt: '2026-01-01T00:00:00.000Z'
        },
        [ACCOUNT_BINDING_STORAGE_KEY]: {
          accountId: USER_A,
          boundAt: '2026-01-01T00:00:00.000Z'
        }
      })
    )
    const result = await applyExternalAuthDeviceHandoff(
      devicePayload({ deviceToken: 'ydt_' + 'c'.repeat(64), deviceId: DEVICE_A })
    )
    expect(result).toEqual({ ok: true })
    const setCalls = vi.mocked(chrome.storage.local.set).mock.calls
    const flattened = Object.assign({}, ...setCalls.map(call => call[0] as StorageMap))
    expect(flattened[DEVICE_SESSION_STORAGE_KEY]).toMatchObject({
      deviceToken: 'ydt_' + 'c'.repeat(64),
      userId: USER_A
    })
    expect(flattened).not.toHaveProperty(ACCOUNT_BINDING_STORAGE_KEY)
    expect(scheduleSilentMemoryEmbeddingMaintenance).not.toHaveBeenCalled()
  })

  it('不同账号 Connect：拒绝覆盖', async () => {
    vi.stubGlobal(
      'chrome',
      createChromeStorageMock({
        [DEVICE_SESSION_STORAGE_KEY]: {
          deviceToken: 'ydt_' + 'b'.repeat(64),
          deviceId: DEVICE_B,
          userId: USER_A,
          isAnonymous: false,
          createdAt: '2026-01-01T00:00:00.000Z'
        },
        [ACCOUNT_BINDING_STORAGE_KEY]: {
          accountId: USER_A,
          boundAt: '2026-01-01T00:00:00.000Z'
        }
      })
    )
    const result = await applyExternalAuthDeviceHandoff(devicePayload({ userId: USER_B }))
    expect(result).toEqual({ ok: false, error: 'account_mismatch' })
    expect(scheduleSilentMemoryEmbeddingMaintenance).not.toHaveBeenCalled()
  })

  it('AN5：匿名占位 + 真实账号 handoff → 覆盖成功', async () => {
    vi.stubGlobal(
      'chrome',
      createChromeStorageMock({
        [DEVICE_SESSION_STORAGE_KEY]: {
          deviceToken: 'ydt_' + 'b'.repeat(64),
          deviceId: DEVICE_B,
          userId: USER_A,
          isAnonymous: true,
          createdAt: '2026-01-01T00:00:00.000Z'
        },
        [ACCOUNT_BINDING_STORAGE_KEY]: {
          accountId: USER_A,
          boundAt: '2026-01-01T00:00:00.000Z'
        }
      })
    )
    const result = await applyExternalAuthDeviceHandoff(
      devicePayload({ userId: USER_B, isAnonymous: false })
    )
    expect(result).toEqual({ ok: true })
    const setCalls = vi.mocked(chrome.storage.local.set).mock.calls
    const flattened = Object.assign({}, ...setCalls.map(call => call[0] as StorageMap))
    expect(flattened[DEVICE_SESSION_STORAGE_KEY]).toMatchObject({
      userId: USER_B,
      isAnonymous: false
    })
    expect(flattened[ACCOUNT_BINDING_STORAGE_KEY]).toMatchObject({
      accountId: USER_B
    })
  })

  it('AN5：真实账号 + 另一真实账号 handoff → 仍硬拒 account_mismatch', async () => {
    vi.stubGlobal(
      'chrome',
      createChromeStorageMock({
        [DEVICE_SESSION_STORAGE_KEY]: {
          deviceToken: 'ydt_' + 'b'.repeat(64),
          deviceId: DEVICE_B,
          userId: USER_A,
          isAnonymous: false,
          createdAt: '2026-01-01T00:00:00.000Z'
        },
        [ACCOUNT_BINDING_STORAGE_KEY]: {
          accountId: USER_A,
          boundAt: '2026-01-01T00:00:00.000Z'
        }
      })
    )
    const result = await applyExternalAuthDeviceHandoff(
      devicePayload({ userId: USER_B, isAnonymous: false })
    )
    expect(result).toEqual({ ok: false, error: 'account_mismatch' })
  })

  it('AN5：匿名占位 + 匿名 handoff → account_mismatch（豁免仅对真实接通）', async () => {
    vi.stubGlobal(
      'chrome',
      createChromeStorageMock({
        [DEVICE_SESSION_STORAGE_KEY]: {
          deviceToken: 'ydt_' + 'b'.repeat(64),
          deviceId: DEVICE_B,
          userId: USER_A,
          isAnonymous: true,
          createdAt: '2026-01-01T00:00:00.000Z'
        },
        [ACCOUNT_BINDING_STORAGE_KEY]: {
          accountId: USER_A,
          boundAt: '2026-01-01T00:00:00.000Z'
        }
      })
    )
    const result = await applyExternalAuthDeviceHandoff(
      devicePayload({ userId: USER_B, isAnonymous: true, email: undefined, displayName: undefined })
    )
    expect(result).toEqual({ ok: false, error: 'account_mismatch' })
  })

  it('AN2.1：成功 handoff 清除预置 401 熔断键', async () => {
    const chromeMock = createChromeStorageMock({
      [ANON_EXCHANGE_401_BACKOFF_STORAGE_KEY]: {
        last401At: '2026-11-21T12:00:00.000Z',
        count: 1
      }
    })
    vi.stubGlobal('chrome', chromeMock)

    const result = await applyExternalAuthDeviceHandoff(devicePayload())
    expect(result).toEqual({ ok: true })
    await vi.waitFor(() => {
      expect(chromeMock.store[ANON_EXCHANGE_401_BACKOFF_STORAGE_KEY]).toBeUndefined()
    })
    expect(chromeMock.store[DEVICE_SESSION_STORAGE_KEY]).toMatchObject({
      userId: USER_A,
      deviceId: DEVICE_A
    })
    expect(chromeMock.store[ACCOUNT_BINDING_STORAGE_KEY]).toMatchObject({
      accountId: USER_A
    })
  })

  it('AN2.1：account_mismatch 拒绝时不动 401 熔断键', async () => {
    const chromeMock = createChromeStorageMock({
      [DEVICE_SESSION_STORAGE_KEY]: {
        deviceToken: 'ydt_' + 'b'.repeat(64),
        deviceId: DEVICE_B,
        userId: USER_A,
        isAnonymous: false,
        createdAt: '2026-01-01T00:00:00.000Z'
      },
      [ACCOUNT_BINDING_STORAGE_KEY]: {
        accountId: USER_A,
        boundAt: '2026-01-01T00:00:00.000Z'
      },
      [ANON_EXCHANGE_401_BACKOFF_STORAGE_KEY]: {
        last401At: '2026-11-21T12:00:00.000Z',
        count: 2
      }
    })
    vi.stubGlobal('chrome', chromeMock)

    const result = await applyExternalAuthDeviceHandoff(devicePayload({ userId: USER_B }))
    expect(result).toEqual({ ok: false, error: 'account_mismatch' })
    expect(chromeMock.store[ANON_EXCHANGE_401_BACKOFF_STORAGE_KEY]).toEqual({
      last401At: '2026-11-21T12:00:00.000Z',
      count: 2
    })
  })

  it('device 写入后立即 ok，embedding 在 bootstrap 后调度', async () => {
    let resolveBoot: (() => void) | undefined
    ensureBackgroundBootstrappedMock.mockReturnValue(
      new Promise(resolve => {
        resolveBoot = () => resolve(undefined)
      })
    )

    const result = await applyExternalAuthDeviceHandoff(devicePayload())
    expect(result).toEqual({ ok: true })
    expect(scheduleSilentMemoryEmbeddingMaintenance).not.toHaveBeenCalled()
    resolveBoot?.()
    await vi.waitFor(() => {
      expect(scheduleSilentMemoryEmbeddingMaintenance).toHaveBeenCalledWith('auth_handoff', 800)
    })
  })

  it('扩展登录态探测：未登录 → signedIn false', async () => {
    const result = await applyExternalAuthHandoff({
      type: 'YIVENO_EXTENSION_AUTH_STATUS_PROBE',
      payload: { expectedUserId: USER_A }
    })
    expect(result).toEqual({ ok: true, signedIn: false })
  })

  it('扩展登录态探测：已有 device session → 回传 userId', async () => {
    vi.stubGlobal(
      'chrome',
      createChromeStorageMock({
        [DEVICE_SESSION_STORAGE_KEY]: {
          deviceToken: 'ydt_' + 'a'.repeat(64),
          deviceId: DEVICE_A,
          userId: USER_A,
          isAnonymous: false,
          email: 'u@example.com',
          displayName: 'User',
          createdAt: '2026-01-01T00:00:00.000Z'
        }
      })
    )
    const result = await applyExternalAuthHandoff({
      type: 'YIVENO_EXTENSION_AUTH_STATUS_PROBE'
    })
    expect(result).toEqual({
      ok: true,
      signedIn: true,
      userId: USER_A,
      isAnonymous: false,
      email: 'u@example.com',
      displayName: 'User'
    })
  })

  it('AN5：STATUS_PROBE 匿名会话 → isAnonymous true；真实会话 → false', async () => {
    vi.stubGlobal(
      'chrome',
      createChromeStorageMock({
        [DEVICE_SESSION_STORAGE_KEY]: {
          deviceToken: 'ydt_' + 'a'.repeat(64),
          deviceId: DEVICE_A,
          userId: USER_A,
          isAnonymous: true,
          createdAt: '2026-01-01T00:00:00.000Z'
        }
      })
    )
    const anonProbe = await applyExternalAuthHandoff({
      type: 'YIVENO_EXTENSION_AUTH_STATUS_PROBE'
    })
    expect(anonProbe).toEqual({
      ok: true,
      signedIn: true,
      userId: USER_A,
      isAnonymous: true
    })

    vi.stubGlobal(
      'chrome',
      createChromeStorageMock({
        [DEVICE_SESSION_STORAGE_KEY]: {
          deviceToken: 'ydt_' + 'a'.repeat(64),
          deviceId: DEVICE_A,
          userId: USER_B,
          isAnonymous: false,
          createdAt: '2026-01-01T00:00:00.000Z'
        }
      })
    )
    const realProbe = await applyExternalAuthHandoff({
      type: 'YIVENO_EXTENSION_AUTH_STATUS_PROBE'
    })
    expect(realProbe).toEqual({
      ok: true,
      signedIn: true,
      userId: USER_B,
      isAnonymous: false
    })
  })

  it('官网会话请求：扩展未登录 → 失败', async () => {
    const result = await applyExternalAuthHandoff({
      type: 'YIVENO_WEBSITE_SESSION_REQUEST',
      payload: { nextPath: '/account' }
    })
    expect(result).toEqual({ ok: false, error: 'not_signed_in' })
  })

  it('register 只挂一次监听', () => {
    registerExternalAuthHandoffListener()
    registerExternalAuthHandoffListener()
    expect(isExternalAuthHandoffListenerRegistered()).toBe(true)
  })
})
