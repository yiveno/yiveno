import { describe, expect, it } from 'vitest'

import { shouldSkipContentExtractForThrottle } from '@/application/memory/page-content-extract-service'
import { PAGE_PREVIEW_OPEN_BACKFILL_MIN_INTERVAL_MS } from '@/infrastructure/indexeddb/page-preview-types'

describe('shouldSkipContentExtractForThrottle', () => {
  const now = Date.parse('2026-11-24T12:00:00.000Z')

  it('无 updatedAt 不节流', () => {
    expect(shouldSkipContentExtractForThrottle(undefined, now)).toBe(false)
  })

  it('7 天内跳过', () => {
    const recent = new Date(now - PAGE_PREVIEW_OPEN_BACKFILL_MIN_INTERVAL_MS + 60_000).toISOString()
    expect(shouldSkipContentExtractForThrottle(recent, now)).toBe(true)
  })

  it('超过 7 天可触发', () => {
    const stale = new Date(now - PAGE_PREVIEW_OPEN_BACKFILL_MIN_INTERVAL_MS - 60_000).toISOString()
    expect(shouldSkipContentExtractForThrottle(stale, now)).toBe(false)
  })
})
