import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { MemoryItem } from '@/core/memory/memory-item'
import {
  buildExcerptLibraryListRows,
  collectBookmarkExportableMemoryIds
} from '@/pages/library/library-excerpt-list-rows'

describe('library-excerpt-list-rows', () => {
  beforeEach(() => {
    vi.stubGlobal('chrome', {
      runtime: {
        getURL: (path: string) => `chrome-extension://test/${path}`
      },
      i18n: {
        getMessage: (key: string) => key,
        getUILanguage: () => 'en-US'
      }
    })
  })

  it('预计算 savedAtLabel', () => {
    const item = {
      id: 'm1',
      type: 'text_excerpt',
      payload: {
        sourceUrl: 'https://example.com',
        selectedText: 'hello',
        pageTitle: 'Example',
        domain: 'example.com'
      },
      clues: { note: 'n' },
      createdAt: '2026-01-15T10:00:00.000Z',
      updatedAt: '2026-01-15T10:00:00.000Z'
    } as MemoryItem

    const rows = buildExcerptLibraryListRows([item])
    expect(rows[0]?.savedAtLabel).toBeTruthy()
    expect(rows[0]?.note).toBe('n')
  })

  it('收集书签 export id', () => {
    const ids = collectBookmarkExportableMemoryIds([
      { kind: 'folder' },
      { kind: 'bookmark', memoryItemId: 'a' },
      { kind: 'bookmark' }
    ])
    expect(ids).toEqual(['a'])
  })
})
