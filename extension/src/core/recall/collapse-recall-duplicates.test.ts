import { describe, expect, it } from 'vitest'

import {
  createBookmarkMemoryItem,
  createTextExcerptMemoryItem
} from '@/core/memory/create-memory-item'
import {
  canonicalizeBookmarkDuplicateUrl,
  collapseRecallMatches,
  compareRecallDuplicateMembers,
  getRecallDuplicateKey,
  recallMatchConflictsWithTopPick,
  pickDuplicateRepresentative,
  serializeRecallDuplicateKey
} from '@/core/recall/collapse-recall-duplicates'
import type { RecallMatch } from '@/core/recall/recall-result'

const baseContext = {
  ownerId: '11111111-1111-4111-8111-111111111111',
  sourceLocalProfileId: '22222222-2222-4222-8222-222222222222',
  now: () => '2026-07-22T06:00:00.000Z'
}

function bookmarkMatch(overrides: {
  title?: string
  url: string
  score?: number
  note?: string
  openCount?: number
  lastOpenedAt?: string
  updatedAt?: string
  createdAt?: string
}): RecallMatch {
  const item = createBookmarkMemoryItem({
    ...baseContext,
    ...(overrides.createdAt || overrides.updatedAt
      ? {
          now: () => overrides.createdAt ?? overrides.updatedAt ?? '2026-07-22T06:00:00.000Z'
        }
      : {}),
    payload: {
      title: overrides.title ?? '标题',
      url: overrides.url
    },
    ...(overrides.note || overrides.openCount !== undefined || overrides.lastOpenedAt
      ? {
          clues: {
            ...(overrides.note ? { note: overrides.note } : {}),
            ...(overrides.openCount !== undefined ? { openCount: overrides.openCount } : {}),
            ...(overrides.lastOpenedAt ? { lastOpenedAt: overrides.lastOpenedAt } : {})
          }
        }
      : {})
  })

  if (overrides.updatedAt) {
    item.updatedAt = overrides.updatedAt
  }
  if (overrides.createdAt) {
    item.createdAt = overrides.createdAt
  }

  return {
    item,
    score: overrides.score ?? 20,
    matchedFields: ['title']
  }
}

function excerptMatch(overrides: {
  text: string
  sourceUrl?: string
  score?: number
  note?: string
}): RecallMatch {
  const item = createTextExcerptMemoryItem({
    ...baseContext,
    payload: {
      selectedText: overrides.text,
      sourceUrl: overrides.sourceUrl ?? 'https://example.com/a',
      pageTitle: '页',
      domain: 'example.com'
    },
    ...(overrides.note ? { clues: { note: overrides.note } } : {})
  })
  return {
    item,
    score: overrides.score ?? 20,
    matchedFields: ['textExcerpt']
  }
}

describe('collapse-recall-duplicates', () => {
  it('书签按规范化 URL 折叠：尾斜杠/www/默认端口同键；不同 path 不同键', () => {
    expect(canonicalizeBookmarkDuplicateUrl('https://www.Example.com/path/')).toBe(
      'https://example.com/path'
    )

    const home = getRecallDuplicateKey(bookmarkMatch({ url: 'https://ai-bot.cn/' }).item)
    const homeNoSlash = getRecallDuplicateKey(bookmarkMatch({ url: 'https://ai-bot.cn' }).item)
    const www = getRecallDuplicateKey(bookmarkMatch({ url: 'https://www.ai-bot.cn/' }).item)
    const path = getRecallDuplicateKey(bookmarkMatch({ url: 'https://ai-bot.cn/tools' }).item)

    expect(serializeRecallDuplicateKey(home)).toBe(serializeRecallDuplicateKey(homeNoSlash))
    expect(serializeRecallDuplicateKey(home)).toBe(serializeRecallDuplicateKey(www))
    expect(serializeRecallDuplicateKey(home)).not.toBe(serializeRecallDuplicateKey(path))
  })

  it('摘录仅正文：同文不同出处同键；书签与摘录不互折', () => {
    const e1 = getRecallDuplicateKey(
      excerptMatch({ text: '同一句', sourceUrl: 'https://a.example/1' }).item
    )
    const e2 = getRecallDuplicateKey(
      excerptMatch({ text: '同一句', sourceUrl: 'https://b.example/2' }).item
    )
    const bookmark = getRecallDuplicateKey(bookmarkMatch({ url: 'https://a.example/1' }).item)
    expect(serializeRecallDuplicateKey(e1)).toBe(serializeRecallDuplicateKey(e2))
    expect(serializeRecallDuplicateKey(e1)).not.toBe(serializeRecallDuplicateKey(bookmark))
  })

  it('代表项优先 score，其次 note', () => {
    const low = bookmarkMatch({
      url: 'https://example.com/same',
      score: 10,
      note: 'with a note'
    })
    const high = bookmarkMatch({
      url: 'https://example.com/same',
      score: 30,
      title: '高分'
    })
    expect(pickDuplicateRepresentative([low, high]).item.id).toBe(high.item.id)

    const withNote = bookmarkMatch({
      url: 'https://example.com/same2',
      score: 20,
      note: 'note'
    })
    const plain = bookmarkMatch({
      url: 'https://example.com/same2',
      score: 20,
      title: 'no note'
    })
    expect(compareRecallDuplicateMembers(withNote, plain)).toBeLessThan(0)
    expect(pickDuplicateRepresentative([plain, withNote]).item.id).toBe(withNote.item.id)
  })

  it('score/附注/行为都相同时取 createdAt 最晚', () => {
    const older = bookmarkMatch({
      url: 'https://example.com/same-time',
      score: 20,
      title: '早',
      createdAt: '2026-01-01T00:00:00.000Z'
    })
    const newer = bookmarkMatch({
      url: 'https://example.com/same-time',
      score: 20,
      title: '晚',
      createdAt: '2026-06-01T00:00:00.000Z'
    })
    expect(pickDuplicateRepresentative([older, newer]).item.id).toBe(newer.item.id)
    expect(pickDuplicateRepresentative([newer, older]).item.id).toBe(newer.item.id)
  })

  it('同 URL 多书签折叠为一条并回填名额；不同 path 不并入 N', () => {
    const sameUrl = 'https://xiapi.example/music'
    const matches = [
      bookmarkMatch({ url: sameUrl, title: 'A', score: 40 }),
      bookmarkMatch({ url: sameUrl, title: 'B', score: 35 }),
      bookmarkMatch({ url: sameUrl, title: 'C', score: 30 }),
      bookmarkMatch({ url: sameUrl, title: 'D', score: 25 }),
      bookmarkMatch({ url: 'https://xiapi.example/other', title: '同站其它', score: 24 }),
      bookmarkMatch({ url: 'https://other.example/1', title: '其它1', score: 22 }),
      bookmarkMatch({ url: 'https://third.example/2', title: '其它2', score: 21 })
    ]

    const collapsed = collapseRecallMatches(matches, { limit: 4 })
    expect(collapsed).toHaveLength(4)
    expect(collapsed[0]?.duplicateGroup?.totalCount).toBe(4)
    expect(collapsed[0]?.duplicateGroup?.siblings).toHaveLength(3)
    expect(collapsed[0]?.item.payload).toMatchObject({ title: 'A' })
    expect(collapsed[1]?.item.payload).toMatchObject({ title: '同站其它' })
    expect(collapsed[1]?.duplicateGroup).toBeUndefined()
  })

  it('同正文摘录折叠；trim 后比较', () => {
    const matches = [
      excerptMatch({ text: '  相同正文  ', sourceUrl: 'https://a.example', score: 30 }),
      excerptMatch({ text: '相同正文', sourceUrl: 'https://b.example', score: 25 })
    ]
    const collapsed = collapseRecallMatches(matches, { limit: 6 })
    expect(collapsed).toHaveLength(1)
    expect(collapsed[0]?.duplicateGroup?.totalCount).toBe(2)
  })

  it('同域名不同 path：折叠键不同，相对 Top 视为冲突', () => {
    const top = bookmarkMatch({ url: 'https://ai-bot.cn/', title: '首页', score: 50 })
    const sameDomainOtherPath = bookmarkMatch({
      url: 'https://ai-bot.cn/tools',
      title: '工具页',
      score: 40
    })
    const otherDomain = bookmarkMatch({
      url: 'https://other.example/ai',
      title: '其它',
      score: 30
    })

    expect(recallMatchConflictsWithTopPick(top, sameDomainOtherPath)).toBe(true)
    expect(recallMatchConflictsWithTopPick(top, otherDomain)).toBe(false)

    const collapsed = collapseRecallMatches([top, sameDomainOtherPath, otherDomain], {
      limit: 6
    })
    expect(collapsed).toHaveLength(3)
    expect(collapsed[0]?.duplicateGroup).toBeUndefined()
  })
})
