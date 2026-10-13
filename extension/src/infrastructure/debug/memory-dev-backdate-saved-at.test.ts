import { describe, expect, it } from 'vitest'

import { daysAgoToSavedAtIso } from '@/infrastructure/debug/memory-dev-backdate-saved-at'

describe('daysAgoToSavedAtIso', () => {
  it('回溯到 UTC 正午', () => {
    const iso = daysAgoToSavedAtIso(14)
    expect(iso).toMatch(/T12:00:00\.000Z$/)
    const ms = Date.parse(iso)
    const now = new Date()
    now.setUTCHours(12, 0, 0, 0)
    const diffDays = Math.round((now.getTime() - ms) / 86_400_000)
    expect(diffDays).toBe(14)
  })
})
