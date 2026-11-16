import { describe, expect, it } from 'vitest'

import {
  buildLibraryTypeLocationSearch,
  DEFAULT_LIBRARY_TYPE,
  LIBRARY_TYPE_TABS,
  parseLibraryTypeFromLocationSearch,
  resolveLibraryTypeTab,
  shouldShowLibraryListCapNote
} from '@/core/memory/library-tabs'

describe('library-tabs', () => {
  it('默认类型为摘录，且侧栏摘录在前', () => {
    expect(DEFAULT_LIBRARY_TYPE).toBe('text_excerpt')
    expect(LIBRARY_TYPE_TABS[0]?.type).toBe('text_excerpt')
    expect(LIBRARY_TYPE_TABS[1]?.type).toBe('bookmark')
  })

  it('resolveLibraryTypeTab 非法值回退摘录', () => {
    expect(resolveLibraryTypeTab('bookmark').type).toBe('bookmark')
    expect(resolveLibraryTypeTab('nope').type).toBe('text_excerpt')
    expect(resolveLibraryTypeTab(undefined).type).toBe('text_excerpt')
  })

  it('parseLibraryTypeFromLocationSearch 从 query 恢复 Tab', () => {
    expect(parseLibraryTypeFromLocationSearch('?type=bookmark')).toBe('bookmark')
    expect(parseLibraryTypeFromLocationSearch('type=text_excerpt')).toBe('text_excerpt')
    expect(parseLibraryTypeFromLocationSearch('')).toBe('text_excerpt')
    expect(parseLibraryTypeFromLocationSearch('?type=nope')).toBe('text_excerpt')
  })

  it('buildLibraryTypeLocationSearch 默认摘录不写 type', () => {
    expect(buildLibraryTypeLocationSearch('text_excerpt')).toBe('')
    expect(buildLibraryTypeLocationSearch('bookmark')).toBe('?type=bookmark')
    expect(buildLibraryTypeLocationSearch('text_excerpt', '?type=bookmark&x=1')).toBe('?x=1')
  })

  it('shouldShowLibraryListCapNote 仅当总数大于已加载时为真', () => {
    expect(shouldShowLibraryListCapNote(200, 200)).toBe(false)
    expect(shouldShowLibraryListCapNote(201, 200)).toBe(true)
    expect(shouldShowLibraryListCapNote(0, 0)).toBe(false)
  })
})
