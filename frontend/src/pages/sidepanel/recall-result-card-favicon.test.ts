import { describe, expect, it } from 'vitest'

import { isFaviconBroken, withBrokenFavicon } from '@/pages/sidepanel/recall-result-card-favicon'

describe('recall-result-card-favicon', () => {
  it('withBrokenFavicon 幂等', () => {
    const initial = new Set<string>(['a'])
    expect(isFaviconBroken(initial, 'a')).toBe(true)
    expect(withBrokenFavicon(initial, 'a')).toBe(initial)
  })

  it('withBrokenFavicon 返回新 Set', () => {
    const initial = new Set<string>()
    const next = withBrokenFavicon(initial, 'b')
    expect(next).not.toBe(initial)
    expect([...next]).toEqual(['b'])
  })
})
