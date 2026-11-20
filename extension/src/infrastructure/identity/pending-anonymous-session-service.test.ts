import { beforeEach, describe, expect, it, vi } from 'vitest'

import { PENDING_ANON_SESSION_STORAGE_KEY } from '@/core/identity/pending-anonymous-session'
import {
  clearPendingAnonymousSession,
  getPendingAnonymousSession,
  setPendingAnonymousSession
} from '@/infrastructure/identity/pending-anonymous-session-service'

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

describe('pending-anonymous-session-service', () => {
  beforeEach(() => {
    storage.clear()
  })

  it('读写往返保留 accessToken / userId / expiresAt', async () => {
    const session = {
      accessToken: 'pending-access-token-abc',
      refreshToken: 'pending-refresh-token-xyz',
      userId: '22222222-2222-4222-8222-222222222222',
      expiresAt: '2026-11-20T12:00:00.000Z',
      createdAt: '2026-11-20T11:00:00.000Z',
      lastExchangeAttemptAt: '2026-11-20T11:05:00.000Z'
    }
    await setPendingAnonymousSession(session)
    const raw = storage.get(PENDING_ANON_SESSION_STORAGE_KEY) as Record<string, unknown>
    expect(raw.accessToken).toBe(session.accessToken)
    expect(raw.userId).toBe(session.userId)
    expect(await getPendingAnonymousSession()).toEqual(session)
  })

  it('clear 后读为 null', async () => {
    await setPendingAnonymousSession({
      accessToken: 'tok',
      userId: '22222222-2222-4222-8222-222222222222',
      expiresAt: '2026-11-20T12:00:00.000Z',
      createdAt: '2026-11-20T11:00:00.000Z'
    })
    await clearPendingAnonymousSession()
    expect(await getPendingAnonymousSession()).toBeNull()
  })

  it('非法形状 → null', async () => {
    storage.set(PENDING_ANON_SESSION_STORAGE_KEY, {
      accessToken: '',
      userId: 'not-a-uuid'
    })
    expect(await getPendingAnonymousSession()).toBeNull()
  })
})
