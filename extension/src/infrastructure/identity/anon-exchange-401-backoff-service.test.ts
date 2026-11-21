import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  ANON_EXCHANGE_401_BACKOFF_STORAGE_KEY,
  PENDING_ANON_SESSION_STORAGE_KEY
} from '@/core/identity/pending-anonymous-session'
import {
  clearAnonExchange401Backoff,
  getAnonExchange401Backoff,
  recordAnonExchange401
} from '@/infrastructure/identity/anon-exchange-401-backoff-service'
import { clearPendingAnonymousSession } from '@/infrastructure/identity/pending-anonymous-session-service'

const storage = new Map<string, unknown>()

vi.stubGlobal('chrome', {
  storage: {
    local: {
      get: vi.fn(async (key: string) => {
        const value = storage.get(key)
        return value === undefined ? {} : { [key]: value }
      }),
      set: vi.fn(async (items: Record<string, unknown>) => {
        for (const [k, v] of Object.entries(items)) {
          storage.set(k, v)
        }
      }),
      remove: vi.fn(async (key: string | string[]) => {
        const keys = Array.isArray(key) ? key : [key]
        for (const k of keys) {
          storage.delete(k)
        }
      })
    }
  }
})

describe('anon-exchange-401-backoff-service', () => {
  beforeEach(() => {
    storage.clear()
  })

  it('record 累加 count，读写往返', async () => {
    const first = await recordAnonExchange401()
    expect(first.count).toBe(1)
    expect(storage.get(ANON_EXCHANGE_401_BACKOFF_STORAGE_KEY)).toEqual(first)
    expect(await getAnonExchange401Backoff()).toEqual(first)

    const second = await recordAnonExchange401()
    expect(second.count).toBe(2)
    expect(second.last401At >= first.last401At).toBe(true)
  })

  it('clear 后读为 null', async () => {
    await recordAnonExchange401()
    await clearAnonExchange401Backoff()
    expect(await getAnonExchange401Backoff()).toBeNull()
  })

  it('清除 pending 不动 401 熔断键', async () => {
    await recordAnonExchange401()
    storage.set(PENDING_ANON_SESSION_STORAGE_KEY, {
      accessToken: 'tok',
      userId: '22222222-2222-4222-8222-222222222222',
      expiresAt: '2026-11-20T12:00:00.000Z',
      createdAt: '2026-11-20T11:00:00.000Z'
    })
    await clearPendingAnonymousSession()
    expect(storage.has(PENDING_ANON_SESSION_STORAGE_KEY)).toBe(false)
    expect(await getAnonExchange401Backoff()).not.toBeNull()
  })
})
