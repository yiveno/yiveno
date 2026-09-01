import { describe, expect, it } from 'vitest'

import {
  createBookmarkMemoryItem,
  createTextExcerptMemoryItem
} from '@/core/memory/create-memory-item'
import type { RecallMatch } from '@/core/recall/recall-result'
import type { TranslateFn } from '@/core/i18n/translate'
import { toRecallMatchCard } from '@/pages/sidepanel/recall-match-card'

const baseContext = {
  ownerId: '11111111-1111-4111-8111-111111111111',
  sourceLocalProfileId: '22222222-2222-4222-8222-222222222222',
  now: () => '2026-07-22T06:00:00.000Z'
}

const detailPageUrl = 'chrome-extension://test/detail.html'

/** 单测用：返回 key 或 key:arg 便于断言 duplicate / saved 文案分支。 */
const mockT: TranslateFn = (key, ...args) => (args.length > 0 ? `${key}:${args.join(',')}` : key)

function bookmarkMatch(url = 'https://example.com/doc'): RecallMatch {
  return {
    item: createBookmarkMemoryItem({
      ...baseContext,
      payload: { title: 'Bookmark title', url }
    }),
    score: 30,
    matchedFields: ['title', 'url']
  }
}

function excerptMatch(text = 'Selected passage'): RecallMatch {
  return {
    item: createTextExcerptMemoryItem({
      ...baseContext,
      payload: {
        selectedText: text,
        sourceUrl: 'https://example.com/a',
        pageTitle: 'Page',
        domain: 'example.com'
      },
      clues: { note: 'my note' }
    }),
    score: 25,
    matchedFields: ['textExcerpt', 'note']
  }
}

describe('toRecallMatchCard', () => {
  it('书签 → itemKind bookmark，detail URL 走 memory-open-href', () => {
    const card = toRecallMatchCard(bookmarkMatch(), 'react hooks', mockT, { detailPageUrl })

    expect(card.itemKind).toBe('bookmark')
    expect(card.title).toBeTruthy()
    expect(card.url).toBe('https://example.com/doc')
    expect(card.reasonCodes).toEqual(['title', 'url'])
    expect(card.telemetryRank).toBeUndefined()
  })

  it('摘录 detail URL 走 memory-open-href', () => {
    const card = toRecallMatchCard(excerptMatch(), 'passage', mockT, { detailPageUrl })

    expect(card.url).toContain('detail.html')
  })

  it('摘录 → itemKind text_excerpt，附注与高亮字段透传', () => {
    const card = toRecallMatchCard(excerptMatch(), 'passage', mockT, { detailPageUrl })

    expect(card.itemKind).toBe('text_excerpt')
    expect(card.note).toBe('my note')
    expect(card.noteParts.length).toBeGreaterThan(0)
    expect(card.reasonLine).toBeTruthy()
  })

  it('telemetryRank 与 rank 选项对齐', () => {
    const card = toRecallMatchCard(bookmarkMatch(), 'clue', mockT, {
      detailPageUrl,
      rank: 2
    })

    expect(card.telemetryRank).toBe(2)
  })

  it('duplicateGroup≥2：展示集合文案并递归映射 siblings', () => {
    const representative = excerptMatch('main excerpt')
    const sibling = excerptMatch('sibling excerpt')
    const match: RecallMatch = {
      ...representative,
      duplicateGroup: {
        totalCount: 2,
        siblings: [sibling]
      }
    }

    const card = toRecallMatchCard(match, 'excerpt clue', mockT, { detailPageUrl })

    expect(card.duplicateTotalCount).toBe(2)
    expect(card.duplicateLabel).toBe('popup_duplicate_group_excerpt:2')
    expect(card.siblings).toHaveLength(1)
    expect(card.siblings![0].id).toBe(sibling.item.id)
    expect(card.siblings![0].siblings).toBeUndefined()
  })

  it('书签 duplicate 用 bookmark 集合文案', () => {
    const match: RecallMatch = {
      ...bookmarkMatch(),
      duplicateGroup: { totalCount: 3, siblings: [] }
    }

    const card = toRecallMatchCard(match, 'clue', mockT, { detailPageUrl })

    expect(card.duplicateLabel).toBe('popup_duplicate_group_bookmark:3')
  })

  it('includeSiblings:false 时不挂 siblings', () => {
    const match: RecallMatch = {
      ...excerptMatch(),
      duplicateGroup: {
        totalCount: 2,
        siblings: [excerptMatch('other')]
      }
    }

    const card = toRecallMatchCard(match, 'clue', mockT, {
      detailPageUrl,
      includeSiblings: false
    })

    expect(card.duplicateTotalCount).toBe(2)
    expect(card.siblings).toBeUndefined()
  })

  it('totalCount<2 时不展示 duplicate 字段', () => {
    const card = toRecallMatchCard(bookmarkMatch(), 'clue', mockT, { detailPageUrl })

    expect(card.duplicateTotalCount).toBeUndefined()
    expect(card.duplicateLabel).toBeUndefined()
  })
})
