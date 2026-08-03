import { beforeEach, describe, expect, it, vi } from 'vitest'

import { applyExternalAuthSessionHandoff } from '@/background/listeners/external-auth-handoff'
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
  return { storage: { local }, store }
}

describe('applyExternalAuthSessionHandoff', () => {
  beforeEach(() => {
    vi.stubGlobal('chrome', createChromeStorageMock())
  })

  it('合法 handoff 写入 session 与 AccountBinding', async () => {
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
  })

  it('非法 payload 返回失败', async () => {
    const result = await applyExternalAuthSessionHandoff({ type: 'NOPE' })
    expect(result.ok).toBe(false)
  })
})
