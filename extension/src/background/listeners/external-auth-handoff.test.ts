import { beforeEach, describe, expect, it, vi } from 'vitest'

const ensureBackgroundBootstrappedMock = vi.hoisted(() => vi.fn(async () => undefined))
const releaseAccountLibraryToLocalProfileMock = vi.hoisted(() => vi.fn(async () => 0))

vi.mock('@/background/bootstrap-ready', () => ({
  ensureBackgroundBootstrapped: ensureBackgroundBootstrappedMock
}))

vi.mock('@/application/identity/release-account-library-to-local', () => ({
  releaseAccountLibraryToLocalProfile: releaseAccountLibraryToLocalProfileMock
}))

vi.mock('@/application/memory/ensure-memory-embedding-maintenance', () => ({
  scheduleSilentMemoryEmbeddingMaintenance: vi.fn()
}))

import {
  applyExternalAuthHandoff,
  applyExternalAuthSessionHandoff,
  isExternalAuthHandoffListenerRegistered,
  registerExternalAuthHandoffListener,
  resetExternalAuthHandoffListenerForTests
} from '@/background/listeners/external-auth-handoff'
import { scheduleSilentMemoryEmbeddingMaintenance } from '@/application/memory/ensure-memory-embedding-maintenance'
import { AUTH_SESSION_STORAGE_KEY } from '@/core/identity/auth-session'
import { ACCOUNT_BINDING_STORAGE_KEY } from '@/core/identity/local-profile'

type StorageMap = Record<string, unknown>

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

describe('external auth handoff', () => {
  beforeEach(() => {
    resetExternalAuthHandoffListenerForTests()
    ensureBackgroundBootstrappedMock.mockClear()
    releaseAccountLibraryToLocalProfileMock.mockClear()
    releaseAccountLibraryToLocalProfileMock.mockResolvedValue(0)
    vi.mocked(scheduleSilentMemoryEmbeddingMaintenance).mockClear()
    vi.stubGlobal('chrome', createChromeStorageMock())
  })

  it('合法 session handoff 写入 session 与 AccountBinding，不静默 absorb', async () => {
    const revokeToken = 'r'.repeat(64)
    const result = await applyExternalAuthSessionHandoff({
      type: 'YIVENO_AUTH_SESSION_HANDOFF',
      payload: {
        accessToken: 'at',
        refreshToken: 'rt',
        userId: '22222222-2222-4222-8222-222222222222',
        email: 'u@example.com',
        uninstallRevokeToken: revokeToken
      }
    })
    expect(result).toEqual({ ok: true })
    expect(chrome.storage.local.set).toHaveBeenCalled()
    expect(chrome.runtime.setUninstallURL).toHaveBeenCalledWith(
      expect.stringContaining('/auth/extension-uninstalled'),
      expect.any(Function)
    )

    const setCalls = vi.mocked(chrome.storage.local.set).mock.calls
    const flattened = Object.assign({}, ...setCalls.map(call => call[0] as StorageMap))
    expect(flattened[AUTH_SESSION_STORAGE_KEY]).toMatchObject({
      accessToken: 'at',
      userId: '22222222-2222-4222-8222-222222222222'
    })
    expect(flattened[AUTH_SESSION_STORAGE_KEY]).not.toHaveProperty('uninstallRevokeToken')
    expect(flattened[ACCOUNT_BINDING_STORAGE_KEY]).toMatchObject({
      accountId: '22222222-2222-4222-8222-222222222222'
    })
    await vi.waitFor(() => {
      expect(ensureBackgroundBootstrappedMock).toHaveBeenCalled()
      expect(scheduleSilentMemoryEmbeddingMaintenance).toHaveBeenCalledWith('auth_handoff', 800)
    })
    expect(releaseAccountLibraryToLocalProfileMock).not.toHaveBeenCalled()
  })

  it('session 写入后立即 ok，embedding 在 bootstrap 后调度', async () => {
    let resolveBoot: (() => void) | undefined
    ensureBackgroundBootstrappedMock.mockReturnValue(
      new Promise(resolve => {
        resolveBoot = () => resolve(undefined)
      })
    )

    const result = await applyExternalAuthSessionHandoff({
      type: 'YIVENO_AUTH_SESSION_HANDOFF',
      payload: {
        accessToken: 'at',
        refreshToken: 'rt',
        userId: '22222222-2222-4222-8222-222222222222'
      }
    })

    expect(result).toEqual({ ok: true })
    expect(scheduleSilentMemoryEmbeddingMaintenance).not.toHaveBeenCalled()
    resolveBoot?.()
    await vi.waitFor(() => {
      expect(scheduleSilentMemoryEmbeddingMaintenance).toHaveBeenCalledWith('auth_handoff', 800)
    })
  })

  it('sign-out handoff 释放账号库后清登录态', async () => {
    const accountId = '22222222-2222-4222-8222-222222222222'
    vi.stubGlobal(
      'chrome',
      createChromeStorageMock({
        [ACCOUNT_BINDING_STORAGE_KEY]: {
          accountId,
          boundAt: '2026-08-01T00:00:00.000Z'
        }
      })
    )
    const result = await applyExternalAuthHandoff({
      type: 'YIVENO_AUTH_SIGN_OUT_HANDOFF',
      payload: { reason: 'website_sign_out' }
    })
    expect(result).toEqual({ ok: true })
    await vi.waitFor(() => {
      expect(releaseAccountLibraryToLocalProfileMock).toHaveBeenCalledWith(accountId)
    })
  })

  it('register 只挂一次监听', () => {
    registerExternalAuthHandoffListener()
    registerExternalAuthHandoffListener()
    expect(isExternalAuthHandoffListenerRegistered()).toBe(true)
  })
})
