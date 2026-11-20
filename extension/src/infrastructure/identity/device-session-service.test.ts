import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DEVICE_SESSION_STORAGE_KEY } from '@/core/identity/device-session'
import {
  clearDeviceSession,
  getDeviceSession,
  setDeviceSession
} from '@/infrastructure/identity/device-session-service'

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

describe('device-session-service', () => {
  beforeEach(() => {
    storage.clear()
  })

  it('读写往返保留 deviceToken / isAnonymous，无 Supabase 字段', async () => {
    const session = {
      deviceToken: 'ydt_' + 'a'.repeat(64),
      deviceId: '11111111-1111-4111-8111-111111111111',
      userId: '22222222-2222-4222-8222-222222222222',
      email: 'user@example.com',
      isAnonymous: false,
      createdAt: '2026-11-20T08:00:00.000Z'
    }
    await setDeviceSession(session)
    const raw = storage.get(DEVICE_SESSION_STORAGE_KEY) as Record<string, unknown>
    expect(raw).not.toHaveProperty('accessToken')
    expect(raw).not.toHaveProperty('refreshToken')
    expect(raw).not.toHaveProperty('expiresAt')
    expect(raw.deviceToken).toBe(session.deviceToken)
    expect(raw.isAnonymous).toBe(false)

    const loaded = await getDeviceSession()
    expect(loaded).toEqual(session)
  })

  it('clear 后读为 null', async () => {
    await setDeviceSession({
      deviceToken: 'ydt_' + 'b'.repeat(64),
      deviceId: '11111111-1111-4111-8111-111111111111',
      userId: '22222222-2222-4222-8222-222222222222',
      isAnonymous: true,
      createdAt: '2026-11-20T08:00:00.000Z'
    })
    await clearDeviceSession()
    expect(await getDeviceSession()).toBeNull()
  })

  it('缺少 isAnonymous / createdAt 的旧形状校验失败 → null', async () => {
    storage.set(DEVICE_SESSION_STORAGE_KEY, {
      deviceToken: 'ydt_' + 'c'.repeat(64),
      deviceId: '11111111-1111-4111-8111-111111111111',
      userId: '22222222-2222-4222-8222-222222222222'
    })
    expect(await getDeviceSession()).toBeNull()
  })
})
