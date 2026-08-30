import { describe, expect, it } from 'vitest'

import { resolveAppSectionTabIndex } from '@/infrastructure/ui/app-section-tabs-keyboard'

describe('resolveAppSectionTabIndex', () => {
  const last = 5

  it('Home/End 跳到首尾', () => {
    expect(resolveAppSectionTabIndex({ key: 'Home', currentIndex: 3, lastIndex: last })).toBe(0)
    expect(resolveAppSectionTabIndex({ key: 'End', currentIndex: 1, lastIndex: last })).toBe(last)
  })

  it('方向键循环', () => {
    expect(resolveAppSectionTabIndex({ key: 'ArrowRight', currentIndex: 2, lastIndex: last })).toBe(
      3
    )
    expect(
      resolveAppSectionTabIndex({ key: 'ArrowDown', currentIndex: last, lastIndex: last })
    ).toBe(0)
    expect(resolveAppSectionTabIndex({ key: 'ArrowLeft', currentIndex: 0, lastIndex: last })).toBe(
      last
    )
    expect(resolveAppSectionTabIndex({ key: 'ArrowUp', currentIndex: 4, lastIndex: last })).toBe(3)
  })

  it('无关按键返回 null', () => {
    expect(resolveAppSectionTabIndex({ key: 'Enter', currentIndex: 1, lastIndex: last })).toBeNull()
  })
})
