import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  readBrowserOnline,
  shouldOmitClueLlmCompleterWhenOffline,
  subscribeBrowserOnline
} from '@/infrastructure/browser/browser-online'

describe('browser-online', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('readBrowserOnline：navigator.onLine=false → false', () => {
    vi.stubGlobal('navigator', { onLine: false })
    expect(readBrowserOnline()).toBe(false)
  })

  it('readBrowserOnline：navigator.onLine=true → true', () => {
    vi.stubGlobal('navigator', { onLine: true })
    expect(readBrowserOnline()).toBe(true)
  })

  it('readBrowserOnline：无 onLine 字段 → 保守 true', () => {
    vi.stubGlobal('navigator', {})
    expect(readBrowserOnline()).toBe(true)
  })

  it('subscribeBrowserOnline：online/offline 事件回调', () => {
    const listeners = new Map<string, Set<EventListener>>()
    vi.stubGlobal('addEventListener', (type: string, fn: EventListener) => {
      const set = listeners.get(type) ?? new Set()
      set.add(fn)
      listeners.set(type, set)
    })
    vi.stubGlobal('removeEventListener', (type: string, fn: EventListener) => {
      listeners.get(type)?.delete(fn)
    })

    const seen: boolean[] = []
    const stop = subscribeBrowserOnline(online => {
      seen.push(online)
    })

    listeners.get('offline')?.forEach(fn => {
      fn(new Event('offline'))
    })
    listeners.get('online')?.forEach(fn => {
      fn(new Event('online'))
    })
    expect(seen).toEqual([false, true])

    stop()
    expect(listeners.get('online')?.size ?? 0).toBe(0)
    expect(listeners.get('offline')?.size ?? 0).toBe(0)
  })

  it('shouldOmitClueLlmCompleterWhenOffline：仅离线省略', () => {
    expect(shouldOmitClueLlmCompleterWhenOffline(false)).toBe(true)
    expect(shouldOmitClueLlmCompleterWhenOffline(true)).toBe(false)
  })
})
