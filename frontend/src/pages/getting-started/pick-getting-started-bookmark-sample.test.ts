import { describe, expect, it } from 'vitest'

import {
  formatGettingStartedBookmarkClue,
  listGettingStartedBookmarkSuggestions,
  pickGettingStartedBookmarkSample,
  resolveGettingStartedSampleClue,
  resolveGettingStartedSampleSuggestions
} from '@/pages/getting-started/pick-getting-started-bookmark-sample'

describe('pick-getting-started-bookmark-sample', () => {
  it('有标题书签：取 savedAt 最近一条做成口语样句', () => {
    const sample = pickGettingStartedBookmarkSample([
      {
        kind: 'bookmark',
        title: 'Older Doc',
        savedAt: '2024-01-01T00:00:00.000Z'
      },
      {
        kind: 'bookmark',
        title: 'Fresh Notes',
        savedAt: '2025-06-01T12:00:00.000Z'
      },
      { kind: 'folder', title: 'Work' }
    ])
    expect(sample).toEqual({
      title: 'Fresh Notes',
      clue: 'That article about Fresh Notes'
    })
  })

  it('listGettingStartedBookmarkSuggestions 最多 3 条、模板轮换、去重标题', () => {
    const samples = listGettingStartedBookmarkSuggestions(
      [
        { kind: 'bookmark', title: 'A', savedAt: '2025-03-01T00:00:00.000Z' },
        { kind: 'bookmark', title: 'B', savedAt: '2025-02-01T00:00:00.000Z' },
        { kind: 'bookmark', title: 'C', savedAt: '2025-01-01T00:00:00.000Z' },
        { kind: 'bookmark', title: 'a', savedAt: '2024-01-01T00:00:00.000Z' },
        { kind: 'bookmark', title: 'D', savedAt: '2023-01-01T00:00:00.000Z' }
      ],
      3
    )
    expect(samples).toHaveLength(3)
    expect(samples.map(s => s.clue)).toEqual([
      'That article about A',
      'Something I saved about B',
      'Something I wanted to read about C'
    ])
  })

  it('空树 → null / 空列表', () => {
    expect(pickGettingStartedBookmarkSample([])).toBeNull()
    expect(listGettingStartedBookmarkSuggestions([])).toEqual([])
  })

  it('仅文件夹或空标题 → null', () => {
    expect(
      pickGettingStartedBookmarkSample([
        { kind: 'folder', title: 'Bookmarks Bar' },
        { kind: 'bookmark', title: '   ' }
      ])
    ).toBeNull()
  })

  it('formatGettingStartedBookmarkClue 空标题退回通用句', () => {
    expect(formatGettingStartedBookmarkClue('')).toBe('something I bookmarked')
    expect(formatGettingStartedBookmarkClue('  ')).toBe('something I bookmarked')
  })

  it('resolveGettingStartedSampleSuggestions：无书签用 fallback', () => {
    expect(resolveGettingStartedSampleSuggestions([], 'something I bookmarked')).toEqual([
      { title: '', clue: 'something I bookmarked' }
    ])
    expect(resolveGettingStartedSampleClue([{ kind: 'bookmark', title: 'MDN' }], 'fallback')).toBe(
      'That article about MDN'
    )
  })
})
