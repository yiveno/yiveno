import { describe, expect, it } from 'vitest'

import { testTranslateEn } from '@/core/i18n/test-translate-en'
import { getTimeOfDayGreeting, resolveTimeOfDayPeriod } from '@/core/recall/time-of-day-greeting'

describe('resolveTimeOfDayPeriod', () => {
  it('划时段：清晨 / 午后 / 傍晚 / 深夜', () => {
    expect(resolveTimeOfDayPeriod(new Date(2026, 0, 1, 5, 0))).toBe('morning')
    expect(resolveTimeOfDayPeriod(new Date(2026, 0, 1, 11, 59))).toBe('morning')
    expect(resolveTimeOfDayPeriod(new Date(2026, 0, 1, 12, 0))).toBe('afternoon')
    expect(resolveTimeOfDayPeriod(new Date(2026, 0, 1, 16, 59))).toBe('afternoon')
    expect(resolveTimeOfDayPeriod(new Date(2026, 0, 1, 17, 0))).toBe('evening')
    expect(resolveTimeOfDayPeriod(new Date(2026, 0, 1, 21, 59))).toBe('evening')
    expect(resolveTimeOfDayPeriod(new Date(2026, 0, 1, 22, 0))).toBe('night')
    expect(resolveTimeOfDayPeriod(new Date(2026, 0, 1, 4, 59))).toBe('night')
  })
})

describe('getTimeOfDayGreeting', () => {
  it('无名时仅时段问候', () => {
    expect(getTimeOfDayGreeting(testTranslateEn, { now: new Date(2026, 0, 1, 19, 0) })).toBe(
      'Good evening'
    )
  })

  it('有展示名时带入问候', () => {
    expect(
      getTimeOfDayGreeting(testTranslateEn, {
        displayName: 'Alex',
        now: new Date(2026, 0, 1, 19, 0)
      })
    ).toBe('Good evening, Alex')
  })

  it('空白展示名视为无名', () => {
    expect(
      getTimeOfDayGreeting(testTranslateEn, {
        displayName: '   ',
        now: new Date(2026, 0, 1, 8, 0)
      })
    ).toBe('Good morning')
  })
})
