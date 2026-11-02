/**
 * pages 薄 re-export 烟测；权威用例在 `core/recall/clue-plain-url.test.ts`。
 */
import { describe, expect, it } from 'vitest'

import {
  formatCluePlainForUserDisplay,
  formatClueUrlDisplayLabel,
  normalizeClueUrl
} from '@/pages/sidepanel/composer/clue-url'

describe('composer/clue-url re-export', () => {
  it('暴露 normalize / display / 可见分面缩短', () => {
    expect(normalizeClueUrl('https://example.com/')).toBe('https://example.com/')
    expect(formatClueUrlDisplayLabel('https://www.example.com/')).toBe('example.com')
    expect(formatCluePlainForUserDisplay('see https://yiveno.com/terms/ now')).toBe(
      'see yiveno.com/terms/ now'
    )
  })
})
