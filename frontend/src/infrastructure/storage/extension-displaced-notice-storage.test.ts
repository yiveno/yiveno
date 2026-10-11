import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  EXTENSION_DISPLACED_NOTICE_KEY,
  clearExtensionDisplacedNotice,
  readExtensionDisplacedNotice,
  writeExtensionDisplacedNotice
} from '@/infrastructure/storage/extension-displaced-notice-storage'

describe('extension-displaced-notice-storage', () => {
  beforeEach(() => {
    const store: Record<string, unknown> = {}
    vi.stubGlobal('chrome', {
      storage: {
        session: {
          get: vi.fn(async (key: string) => ({ [key]: store[key] })),
          set: vi.fn(async (items: Record<string, unknown>) => {
            Object.assign(store, items)
          }),
          remove: vi.fn(async (key: string) => {
            delete store[key]
          })
        }
      }
    })
  })

  it('读写与清除', async () => {
    await expect(readExtensionDisplacedNotice()).resolves.toBe(false)
    await writeExtensionDisplacedNotice()
    await expect(readExtensionDisplacedNotice()).resolves.toBe(true)
    expect(chrome.storage.session.set).toHaveBeenCalledWith(
      expect.objectContaining({
        [EXTENSION_DISPLACED_NOTICE_KEY]: expect.objectContaining({ at: expect.any(Number) })
      })
    )
    await clearExtensionDisplacedNotice()
    await expect(readExtensionDisplacedNotice()).resolves.toBe(false)
  })
})
