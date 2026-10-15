import { beforeEach, describe, expect, it, vi } from 'vitest'

const { isSuppressedMock } = vi.hoisted(() => ({
  isSuppressedMock: vi.fn(async () => false)
}))

vi.mock('@/infrastructure/storage/suppress-displaced-notice-storage', () => ({
  isDisplacedNoticeSuppressed: isSuppressedMock
}))

import {
  DISPLACED_NOTICE_REASON,
  EXTENSION_DISPLACED_NOTICE_KEY,
  clearExtensionDisplacedNotice,
  maybeWriteExtensionDisplacedNotice,
  readExtensionDisplacedNotice,
  writeExtensionDisplacedNotice
} from '@/infrastructure/storage/extension-displaced-notice-storage'

describe('extension-displaced-notice-storage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isSuppressedMock.mockResolvedValue(false)
    const store: Record<string, unknown> = {}
    vi.stubGlobal('chrome', {
      storage: {
        session: {
          get: vi.fn(async (keys?: string | string[]) => {
            if (typeof keys === 'string') {
              return keys in store ? { [keys]: store[keys] } : {}
            }
            return { ...store }
          }),
          set: vi.fn(async (items: Record<string, unknown>) => {
            Object.assign(store, items)
          }),
          remove: vi.fn(async (keys: string | string[]) => {
            const list = Array.isArray(keys) ? keys : [keys]
            for (const k of list) {
              delete store[k]
            }
          })
        }
      }
    })
  })

  it('write + read + clear', async () => {
    await writeExtensionDisplacedNotice()
    expect(await readExtensionDisplacedNotice()).toBe(true)
    await clearExtensionDisplacedNotice()
    expect(await readExtensionDisplacedNotice()).toBe(false)
  })

  it('maybeWrite：非 lease displaced reason → 不写', async () => {
    expect(await maybeWriteExtensionDisplacedNotice('session_revoked')).toBe(false)
    expect(await readExtensionDisplacedNotice()).toBe(false)
  })

  it('maybeWrite：lease displaced → 写入', async () => {
    expect(await maybeWriteExtensionDisplacedNotice(DISPLACED_NOTICE_REASON)).toBe(true)
    expect(await readExtensionDisplacedNotice()).toBe(true)
    expect(chrome.storage.session.set).toHaveBeenCalledWith(
      expect.objectContaining({
        [EXTENSION_DISPLACED_NOTICE_KEY]: expect.objectContaining({ at: expect.any(Number) })
      })
    )
  })

  it('maybeWrite：本机 Connect 抑制窗内 → 不写', async () => {
    isSuppressedMock.mockResolvedValue(true)
    expect(await maybeWriteExtensionDisplacedNotice(DISPLACED_NOTICE_REASON)).toBe(false)
    expect(await readExtensionDisplacedNotice()).toBe(false)
  })
})
