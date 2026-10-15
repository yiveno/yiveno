import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  SUPPRESS_DISPLACED_NOTICE_KEY,
  beginSuppressDisplacedNotice,
  endSuppressDisplacedNotice,
  isDisplacedNoticeSuppressed
} from '@/infrastructure/storage/suppress-displaced-notice-storage'

describe('suppress-displaced-notice-storage', () => {
  beforeEach(() => {
    vi.useRealTimers()
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

  it('begin → suppressed；end → 解除', async () => {
    expect(await isDisplacedNoticeSuppressed()).toBe(false)
    await beginSuppressDisplacedNotice(60_000)
    expect(await isDisplacedNoticeSuppressed()).toBe(true)
    expect(chrome.storage.session.set).toHaveBeenCalledWith(
      expect.objectContaining({
        [SUPPRESS_DISPLACED_NOTICE_KEY]: expect.objectContaining({ until: expect.any(Number) })
      })
    )
    await endSuppressDisplacedNotice()
    expect(await isDisplacedNoticeSuppressed()).toBe(false)
  })

  it('过期后自动解除', async () => {
    vi.useFakeTimers()
    await beginSuppressDisplacedNotice(5_000)
    expect(await isDisplacedNoticeSuppressed()).toBe(true)
    vi.advanceTimersByTime(5_001)
    expect(await isDisplacedNoticeSuppressed()).toBe(false)
  })
})
