import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/infrastructure/i18n/t', () => ({
  getUILanguage: vi.fn(() => 'en-US')
}))

import { formatLibrarySavedAt } from '@/infrastructure/i18n/format-library-saved-at'

describe('formatLibrarySavedAt', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('当年条目不含年份', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-16T12:00:00.000Z'))
    const label = formatLibrarySavedAt('2026-03-10T08:30:00.000Z')
    expect(label).toMatch(/Mar/)
    expect(label).not.toMatch(/2026/)
  })

  it('往年条目含年份', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-16T12:00:00.000Z'))
    const label = formatLibrarySavedAt('2025-03-10T08:30:00.000Z')
    expect(label).toMatch(/2025/)
  })

  it('非法 ISO 返回空串', () => {
    expect(formatLibrarySavedAt('')).toBe('')
    expect(formatLibrarySavedAt('not-a-date')).toBe('')
  })
})
