import { describe, expect, it } from 'vitest'

import {
  DEFAULT_GETTING_STARTED_TAB,
  GETTING_STARTED_TAB_IDS,
  isGettingStartedTabId
} from '@/pages/getting-started/getting-started-tabs'

describe('getting-started-tabs', () => {
  it('默认 bookmarks；闭集校验', () => {
    expect(DEFAULT_GETTING_STARTED_TAB).toBe('bookmarks')
    expect(GETTING_STARTED_TAB_IDS).toEqual(['bookmarks', 'excerpts'])
    expect(isGettingStartedTabId('bookmarks')).toBe(true)
    expect(isGettingStartedTabId('excerpts')).toBe(true)
    expect(isGettingStartedTabId('library')).toBe(false)
  })
})
