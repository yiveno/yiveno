import { describe, expect, it } from 'vitest'

import {
  buildLibraryTypeLocationSearch,
  DEFAULT_LIBRARY_TYPE,
  LIBRARY_TYPE_TABS,
  parseLibraryTypeFromLocationSearch,
  resolveLibraryTypeTab
} from '@/core/memory/library-tabs'

describe('library-tabs', () => {
  it('默认类型为书签', () => {
    expect(DEFAULT_LIBRARY_TYPE).toBe('bookmark')
    expect(LIBRARY_TYPE_TABS[0]?.type).toBe('bookmark')
  })

  it('resolveLibraryTypeTab 非法值回退书签', () => {
    expect(resolveLibraryTypeTab('text_excerpt').type).toBe('text_excerpt')
    expect(resolveLibraryTypeTab('nope').type).toBe('bookmark')
    expect(resolveLibraryTypeTab(undefined).type).toBe('bookmark')
  })

  it('parseLibraryTypeFromLocationSearch 从 query 恢复 Tab', () => {
    expect(parseLibraryTypeFromLocationSearch('?type=text_excerpt')).toBe('text_excerpt')
    expect(parseLibraryTypeFromLocationSearch('type=bookmark')).toBe('bookmark')
    expect(parseLibraryTypeFromLocationSearch('')).toBe('bookmark')
    expect(parseLibraryTypeFromLocationSearch('?type=nope')).toBe('bookmark')
  })

  it('buildLibraryTypeLocationSearch 默认书签不写 type', () => {
    expect(buildLibraryTypeLocationSearch('bookmark')).toBe('')
    expect(buildLibraryTypeLocationSearch('text_excerpt')).toBe('?type=text_excerpt')
    expect(buildLibraryTypeLocationSearch('bookmark', '?type=text_excerpt&x=1')).toBe('?x=1')
  })
})
