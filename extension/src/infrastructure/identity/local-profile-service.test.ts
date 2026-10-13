import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  ACCOUNT_BINDING_STORAGE_KEY,
  LOCAL_PROFILE_STORAGE_KEY,
  type LocalProfile
} from '@/core/identity/local-profile'
import {
  getAccountBinding,
  getCurrentOwnerId,
  getOrCreateLocalProfile,
  setAccountBinding,
  clearAccountBinding
} from '@/infrastructure/identity/local-profile-service'

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
      const keyList = Array.isArray(keys) ? keys : [keys]
      for (const key of keyList) {
        delete store[key]
      }
    })
  }

  return { storage: { local }, store }
}

describe('local-profile-service', () => {
  beforeEach(() => {
    vi.stubGlobal('chrome', createChromeStorageMock())
  })

  it('首次调用会创建并持久化 localProfileId', async () => {
    const profile = await getOrCreateLocalProfile()

    expect(profile.schemaVersion).toBe(1)
    expect(profile.localProfileId).toBeTruthy()

    expect(chrome.storage.local.set).toHaveBeenCalled()

    const again = await getOrCreateLocalProfile()
    expect(again.localProfileId).toBe(profile.localProfileId)
  })

  it('未绑定时 getCurrentOwnerId 返回 localProfileId', async () => {
    const profile = await getOrCreateLocalProfile()
    await expect(getCurrentOwnerId()).resolves.toBe(profile.localProfileId)
  })

  it('已绑定时 getCurrentOwnerId 返回 accountId', async () => {
    const profile: LocalProfile = {
      localProfileId: '11111111-1111-4111-8111-111111111111',
      createdAt: '2026-07-22T05:00:00.000Z',
      schemaVersion: 1
    }

    vi.stubGlobal(
      'chrome',
      createChromeStorageMock({
        [LOCAL_PROFILE_STORAGE_KEY]: profile,
        [ACCOUNT_BINDING_STORAGE_KEY]: {
          accountId: '22222222-2222-4222-8222-222222222222',
          boundAt: '2026-07-22T06:00:00.000Z'
        }
      })
    )

    await expect(getCurrentOwnerId()).resolves.toBe('22222222-2222-4222-8222-222222222222')
    await expect(getAccountBinding()).resolves.toMatchObject({
      accountId: '22222222-2222-4222-8222-222222222222'
    })
  })

  it('setAccountBinding / clearAccountBinding 可写可清', async () => {
    await getOrCreateLocalProfile()
    await setAccountBinding({
      accountId: '33333333-3333-4333-8333-333333333333',
      boundAt: '2026-08-03T12:00:00.000Z'
    })
    await expect(getCurrentOwnerId()).resolves.toBe('33333333-3333-4333-8333-333333333333')

    await clearAccountBinding()
    const profile = await getOrCreateLocalProfile()
    await expect(getAccountBinding()).resolves.toBeNull()
    await expect(getCurrentOwnerId()).resolves.toBe(profile.localProfileId)
  })
})
