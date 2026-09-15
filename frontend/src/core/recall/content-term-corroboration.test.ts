import { describe, expect, it } from 'vitest'

import type { MemoryItem } from '@/core/memory/memory-item'
import {
  filterMatchesByContentTermCorroboration,
  itemCorroboratesContentTerms,
  normalizeContentTermsForCorroboration,
  parsedClueForTimeSoftReopen,
  shouldAttemptTimeSoftReopen
} from '@/core/recall/content-term-corroboration'
import type { ParsedRecallClue } from '@/core/recall/parse-recall-clue-types'
import type { RecallMatch } from '@/core/recall/recall-result'

const ownerId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const profileId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

function excerptItem(input: {
  id: string
  selectedText: string
  pageTitle?: string
  note?: string
  sourceUrl?: string
  createdAt?: string
}): MemoryItem {
  return {
    id: input.id,
    ownerId,
    sourceLocalProfileId: profileId,
    type: 'text_excerpt',
    payload: {
      selectedText: input.selectedText,
      sourceUrl: input.sourceUrl ?? 'https://docs.google.com/document/d/x',
      pageTitle: input.pageTitle ?? 'Notes',
      domain: 'docs.google.com'
    },
    clues: {
      title: input.pageTitle ?? 'Notes',
      textExcerpt: input.selectedText,
      keywords: [],
      entities: [],
      tags: [],
      openCount: 0,
      dismissCount: 0,
      ...(input.note ? { note: input.note } : {}),
      ...(input.sourceUrl ? { sourceUrl: input.sourceUrl } : {})
    },
    createdAt: input.createdAt ?? '2026-09-10T12:00:00.000Z',
    updatedAt: input.createdAt ?? '2026-09-10T12:00:00.000Z'
  }
}

const standupScrap = excerptItem({
  id: '11111111-1111-4111-8111-111111111111',
  selectedText: 'Standup scrap — blockers copied from yesterday.',
  note: 'wait on vendor SSO reply',
  sourceUrl: 'https://docs.google.com/document/d/yivenoProbeStandupScrap01'
})

const retentionArticle = excerptItem({
  id: '22222222-2222-4222-8222-222222222222',
  selectedText: 'Cloud recording retention and who can download',
  pageTitle: 'Zoom support',
  sourceUrl: 'https://support.zoom.com/hc/en/article?id=zm_kb_recording',
  createdAt: '2026-09-03T12:00:00.000Z'
})

const yesterdayHighParsed: ParsedRecallClue = {
  raw: 'that article I saved yesterday about retention',
  timeRange: {
    from: '2026-09-10T00:00:00.000Z',
    to: '2026-09-10T23:59:59.999Z',
    label: 'yesterday'
  },
  timeConfidence: 'high',
  objectTypes: ['article'],
  contentTerms: ['retention'],
  confidence: 'high'
}

describe('content-term-corroboration', () => {
  it('normalizeContentTermsForCorroboration 去空去重', () => {
    expect(normalizeContentTermsForCorroboration(['Retention', ' retention ', ''])).toEqual([
      'retention'
    ])
    expect(normalizeContentTermsForCorroboration([])).toEqual([])
  })

  it('standup 摘录对 retention 无佐证（真机失败例）', () => {
    expect(itemCorroboratesContentTerms(standupScrap, ['retention'])).toBe(false)
  })

  it('Zoom retention 标题/正文有佐证', () => {
    expect(itemCorroboratesContentTerms(retentionArticle, ['retention'])).toBe(true)
  })

  it('contentTerms 空 → 视为通过（不误伤约束邻域）', () => {
    expect(itemCorroboratesContentTerms(standupScrap, [])).toBe(true)
    expect(itemCorroboratesContentTerms(standupScrap, undefined)).toBe(true)
  })

  it('filterMatchesByContentTermCorroboration 剔除无佐证', () => {
    const matches: RecallMatch[] = [
      { item: standupScrap, score: 91, matchedFields: ['embedding', 'hybridRrf'] },
      { item: retentionArticle, score: 40, matchedFields: ['title'] }
    ]
    const filtered = filterMatchesByContentTermCorroboration(matches, ['retention'])
    expect(filtered).toHaveLength(1)
    expect(filtered[0]?.item.id).toBe(retentionArticle.id)
  })

  it('仅弱残留 → 佐证门关闭（与 Filter 有效词空同源）', () => {
    expect(normalizeContentTermsForCorroboration(['like', 'good', 'fun'])).toEqual([])
    // 有效词空：不误伤（门关闭）
    expect(itemCorroboratesContentTerms(standupScrap, ['like', 'good', 'fun'])).toBe(true)
  })

  it('有效内容词 + 弱残留：仅有效词可佐证', () => {
    expect(itemCorroboratesContentTerms(standupScrap, ['like', 'retention'])).toBe(false)
    expect(itemCorroboratesContentTerms(retentionArticle, ['like', 'retention'])).toBe(true)
    expect(normalizeContentTermsForCorroboration(['Like', 'retention'])).toEqual(['retention'])
  })

  it('弱 embedding 命中仅含 like 时，有有效词 retention 则剔除', () => {
    const filtered = filterMatchesByContentTermCorroboration(
      [
        { item: standupScrap, score: 91, matchedFields: ['embedding'] },
        { item: retentionArticle, score: 40, matchedFields: ['title'] }
      ],
      ['like', 'retention']
    )
    expect(filtered).toHaveLength(1)
    expect(filtered[0]?.item.id).toBe(retentionArticle.id)
  })

  it('shouldAttemptTimeSoftReopen：high + 有 contentTerms + 0 佐证 → true', () => {
    expect(shouldAttemptTimeSoftReopen(yesterdayHighParsed, 0)).toBe(true)
    expect(shouldAttemptTimeSoftReopen(yesterdayHighParsed, 1)).toBe(false)
    expect(shouldAttemptTimeSoftReopen({ ...yesterdayHighParsed, contentTerms: [] }, 0)).toBe(false)
  })

  it('shouldAttemptTimeSoftReopen：刚存无 timeRange 仍可 soft', () => {
    const justSaved: ParsedRecallClue = {
      raw: 'just saved something about retention',
      behaviorHints: ['recently_saved'],
      contentTerms: ['retention'],
      confidence: 'medium'
    }
    expect(shouldAttemptTimeSoftReopen(justSaved, 0)).toBe(true)
  })

  it('parsedClueForTimeSoftReopen 强制 timeConfidence=low', () => {
    const soft = parsedClueForTimeSoftReopen(yesterdayHighParsed)
    expect(soft.timeConfidence).toBe('low')
    expect(soft.contentTerms).toEqual(['retention'])
    expect(soft.timeRange?.label).toBe('yesterday')
  })
})
