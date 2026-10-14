import { describe, expect, it } from 'vitest'

import {
  filterCloudSyncableMemoryItems,
  isCloudSyncableMemoryItem
} from '@/core/memory/cloud-syncable-memory-item'
import type { MemoryItem } from '@/core/memory/memory-item'

const owner = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

function excerpt(id: string): MemoryItem {
  return {
    id,
    ownerId: owner,
    sourceLocalProfileId: owner,
    type: 'text_excerpt',
    payload: {
      selectedText: 'x',
      sourceUrl: 'https://example.com/p',
      pageTitle: 't',
      domain: 'example.com'
    },
    clues: {
      keywords: [],
      entities: [],
      tags: [],
      openCount: 0,
      settledCount: 0,
      dismissCount: 0
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  }
}

function bookmark(id: string): MemoryItem {
  return {
    id,
    ownerId: owner,
    sourceLocalProfileId: owner,
    type: 'bookmark',
    payload: {
      title: 't',
      url: 'https://example.com/b',
      domain: 'example.com',
      chromeBookmarkId: '1'
    },
    clues: {
      keywords: [],
      entities: [],
      tags: [],
      openCount: 0,
      settledCount: 0,
      dismissCount: 0
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  }
}

describe('isCloudSyncableMemoryItem', () => {
  it('仅 text_excerpt 可同步', () => {
    expect(isCloudSyncableMemoryItem(excerpt('11111111-1111-4111-8111-111111111111'))).toBe(true)
    expect(isCloudSyncableMemoryItem(bookmark('22222222-2222-4222-8222-222222222222'))).toBe(false)
  })

  it('filterCloudSyncableMemoryItems 丢掉书签', () => {
    const items = [
      excerpt('11111111-1111-4111-8111-111111111111'),
      bookmark('22222222-2222-4222-8222-222222222222'),
      excerpt('33333333-3333-4333-8333-333333333333')
    ]
    expect(filterCloudSyncableMemoryItems(items).map(i => i.id)).toEqual([
      '11111111-1111-4111-8111-111111111111',
      '33333333-3333-4333-8333-333333333333'
    ])
  })
})
