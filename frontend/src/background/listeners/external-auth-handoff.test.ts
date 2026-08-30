import { beforeEach, describe, expect, it, vi } from 'vitest'

const ensureBackgroundBootstrappedMock = vi.hoisted(() => vi.fn(async () => undefined))

vi.mock('@/background/bootstrap', () => ({
  ensureBackgroundBootstrapped: ensureBackgroundBootstrappedMock
}))

vi.mock('@/application/identity/absorb-local-profile-into-account', () => ({
  absorbLocalProfileIntoAccount: vi.fn(async () => 0)
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
import { absorbLocalProfileIntoAccount } from '@/application/identity/absorb-local-profile-into-account'
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
  return { storage: { local, session }, store }
}

describe('external auth handoff', () => {
  beforeEach(() => {
    resetExternalAuthHandoffListenerForTests()
    ensureBackgroundBootstrappedMock.mockClear()
    vi.stubGlobal('chrome', createChromeStorageMock())
  })

  it('合法 session handoff 写入 session 与 AccountBinding', async () => {
    const result = await applyExternalAuthSessionHandoff({
      type: 'YIVENO_AUTH_SESSION_HANDOFF',
      payload: {
        accessToken: 'at',
        refreshToken: 'rt',
        userId: '22222222-2222-4222-8222-222222222222',
        email: 'u@example.com'
      }
    })
    expect(result).toEqual({ ok: true })
    expect(chrome.storage.local.set).toHaveBeenCalled()

    const setCalls = vi.mocked(chrome.storage.local.set).mock.calls
    const flattened = Object.assign({}, ...setCalls.map(call => call[0] as StorageMap))
    expect(flattened[AUTH_SESSION_STORAGE_KEY]).toMatchObject({
      accessToken: 'at',
      userId: '22222222-2222-4222-8222-222222222222'
    })
    expect(flattened[ACCOUNT_BINDING_STORAGE_KEY]).toMatchObject({
      accountId: '22222222-2222-4222-8222-222222222222'
    })
    await vi.waitFor(() => {
      expect(ensureBackgroundBootstrappedMock).toHaveBeenCalled()
      expect(absorbLocalProfileIntoAccount).toHaveBeenCalledWith(
        '22222222-2222-4222-8222-222222222222'
      )
      expect(scheduleSilentMemoryEmbeddingMaintenance).toHaveBeenCalledWith('auth_handoff', 800)
    })
  })

  it('session 写入后立即 ok，不阻塞本地档归并', async () => {
    let resolveAbsorb: ((count: number) => void) | undefined
    vi.mocked(absorbLocalProfileIntoAccount).mockReturnValue(
      new Promise(resolve => {
        resolveAbsorb = resolve
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
    expect(resolveAbsorb).toBeTypeOf('function')
    await vi.waitFor(() => {
      expect(ensureBackgroundBootstrappedMock).toHaveBeenCalled()
      expect(scheduleSilentMemoryEmbeddingMaintenance).toHaveBeenCalled()
    })
    resolveAbsorb?.(1)
  })

  it('sign-out handoff 清登录态', async () => {
    const result = await applyExternalAuthHandoff({
      type: 'YIVENO_AUTH_SIGN_OUT_HANDOFF',
      payload: { reason: 'website_sign_out' }
    })
    expect(result).toEqual({ ok: true })
    expect(chrome.storage.local.remove).toHaveBeenCalled()
  })

  it('非法 payload 返回失败', async () => {
    const result = await applyExternalAuthHandoff({ type: 'NOPE' })
    expect(result.ok).toBe(false)
  })
})

describe('registerExternalAuthHandoffListener', () => {
  beforeEach(() => {
    resetExternalAuthHandoffListenerForTests()
    ensureBackgroundBootstrappedMock.mockClear()
    vi.stubGlobal('chrome', {
      ...createChromeStorageMock(),
      runtime: {
        onMessageExternal: { addListener: vi.fn() }
      }
    })
  })

  it('幂等注册 onMessageExternal', () => {
    registerExternalAuthHandoffListener()
    registerExternalAuthHandoffListener()

    expect(chrome.runtime.onMessageExternal.addListener).toHaveBeenCalledTimes(1)
    expect(isExternalAuthHandoffListenerRegistered()).toBe(true)
  })

  it('拒绝非白名单 origin', async () => {
    registerExternalAuthHandoffListener()

    const handler = (chrome.runtime.onMessageExternal.addListener as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[0] as (
      message: unknown,
      sender: { url?: string },
      sendResponse: (response: unknown) => void
    ) => boolean

    const sendResponse = vi.fn()
    const keepChannelOpen = handler(
      { type: 'YIVENO_AUTH_SESSION_HANDOFF', payload: {} },
      { url: 'https://evil.com/callback' },
      sendResponse
    )

    expect(keepChannelOpen).toBe(false)
    expect(sendResponse).toHaveBeenCalledWith({ ok: false, error: 'forbidden_origin' })
  })

  it('白名单 origin 异步回传 handoff 结果', async () => {
    registerExternalAuthHandoffListener()

    const handler = (chrome.runtime.onMessageExternal.addListener as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[0] as (
      message: unknown,
      sender: { url?: string },
      sendResponse: (response: unknown) => void
    ) => boolean

    const sendResponse = vi.fn()
    const keepChannelOpen = handler(
      {
        type: 'YIVENO_AUTH_SIGN_OUT_HANDOFF',
        payload: { reason: 'website_sign_out' }
      },
      { url: 'https://yiveno.com/account' },
      sendResponse
    )

    expect(keepChannelOpen).toBe(true)

    await vi.waitFor(() => {
      expect(sendResponse).toHaveBeenCalledWith({ ok: true })
    })
  })
})
