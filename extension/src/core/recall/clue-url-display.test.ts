import { describe, expect, it } from 'vitest'

import {
  clueUrlLookupKey,
  formatClueUrlResolvedTitle,
  resolveClueUrlChipLabel
} from '@/core/recall/clue-url-display'

describe('clueUrlLookupKey', () => {
  it('去 www / hash / 尾斜杠并对齐', () => {
    expect(clueUrlLookupKey('https://www.Example.com/path/?q=1#x')).toBe(
      'https://example.com/path?q=1'
    )
    expect(clueUrlLookupKey('https://example.com/path/')).toBe('https://example.com/path')
  })
})

describe('resolveClueUrlChipLabel', () => {
  it('有标题用截断标题，否则缩短 host/path', () => {
    expect(resolveClueUrlChipLabel('https://example.com/a', 'Hydration reaction')).toBe(
      'Hydration reaction'
    )
    expect(resolveClueUrlChipLabel('https://example.com/a', null)).toBe('example.com/a')
    expect(formatClueUrlResolvedTitle('  lots   of   space  ')).toBe('lots of space')
  })
})
