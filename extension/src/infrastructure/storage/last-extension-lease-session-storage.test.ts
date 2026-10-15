import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  LAST_EXTENSION_LEASE_SESSION_KEY,
  clearLastExtensionLeaseSessionId,
  isExtensionLeaseReclaimable,
  readLastExtensionLeaseSessionId,
  writeLastExtensionLeaseSessionId
} from '@/infrastructure/storage/last-extension-lease-session-storage'

type StorageMap = Record<string, unknown>

function installChromeLocal(store: StorageMap): void {
  vi.stubGlobal('chrome', {
    storage: {
      local: {
        get: vi.fn(async (key: string) => ({ [key]: store[key] })),
        set: vi.fn(async (items: StorageMap) => {
          Object.assign(store, items)
        }),
        remove: vi.fn(async (keys: string | string[]) => {
          for (const key of Array.isArray(keys) ? keys : [keys]) {
            delete store[key]
          }
        })
      }
    }
  })
}

describe('last-extension-lease-session-storage', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it('读写清除', async () => {
    const store: StorageMap = {}
    installChromeLocal(store)
    expect(await readLastExtensionLeaseSessionId()).toBeNull()
    await writeLastExtensionLeaseSessionId('sess-1')
    expect(store[LAST_EXTENSION_LEASE_SESSION_KEY]).toEqual({ sessionId: 'sess-1' })
    expect(await readLastExtensionLeaseSessionId()).toBe('sess-1')
    await clearLastExtensionLeaseSessionId()
    expect(await readLastExtensionLeaseSessionId()).toBeNull()
  })

  it('认领：本地 session 与租约一致才可 reclaim', async () => {
    const store: StorageMap = {}
    installChromeLocal(store)
    expect(await isExtensionLeaseReclaimable('sess-a')).toBe(false)
    await writeLastExtensionLeaseSessionId('sess-a')
    expect(await isExtensionLeaseReclaimable('sess-a')).toBe(true)
    expect(await isExtensionLeaseReclaimable('sess-other')).toBe(false)
  })
})
