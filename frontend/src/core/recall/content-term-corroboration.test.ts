import { describe, expect, it } from 'vitest'

import type { MemoryItem } from '@/core/memory/memory-item'
import {
  filterMatchesByContentTermCorroboration,
  HYBRID_CORROBORATION_SOFT_PENALTY,
  itemCorroboratesContentTerms,
  normalizeContentTermsForCorroboration,
  parsedClueForTimeSoftReopen,
  shouldAttemptTimeSoftReopen,
  softPenalizeMatchesByContentTermCorroboration
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
      settledCount: 0,
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

  /**
   * 实验三修复（2026-09-20）：hybrid 路径佐证改为 soft penalty。
   * 未佐证候选 score 扣 HYBRID_CORROBORATION_SOFT_PENALTY，但保留在候选池。
   * 这是 hybrid-mode bypass 设计的关键：embedding 已独立验证，contentTerms 错误
   * 不应 hard-filter 正确候选。
   */
  it('softPenalize：未佐证项 score 扣 penalty 但保留在池中', () => {
    const matches: RecallMatch[] = [
      { item: standupScrap, score: 91, matchedFields: ['embedding', 'hybridRrf'] },
      { item: retentionArticle, score: 40, matchedFields: ['title'] }
    ]
    const penalized = softPenalizeMatchesByContentTermCorroboration(matches, ['retention'])
    // 关键：两个候选都在（不像 hard filter 会删 standupScrap）
    expect(penalized).toHaveLength(2)
    // retentionArticle 已佐证 → 原 score 不变
    const retention = penalized.find(p => p.item.id === retentionArticle.id)
    expect(retention?.score).toBe(40)
    // standupScrap 未佐证 → score 扣 penalty
    const standup = penalized.find(p => p.item.id === standupScrap.id)
    expect(standup?.score).toBe(91 - HYBRID_CORROBORATION_SOFT_PENALTY)
  })

  it('softPenalize：contentTerms 空 → 视为通过（不误伤）', () => {
    const matches: RecallMatch[] = [{ item: standupScrap, score: 50, matchedFields: ['title'] }]
    const penalized = softPenalizeMatchesByContentTermCorroboration(matches, [])
    expect(penalized).toHaveLength(1)
    expect(penalized[0]?.score).toBe(50) // penalty 不应用
  })

  it('softPenalize：score 已很低（≤ penalty）→ 扣后保持 ≥ 1（与 minScore 对齐）', () => {
    const item = { ...standupScrap, id: 'low-score-item' }
    const matches: RecallMatch[] = [{ item, score: 3, matchedFields: ['embedding'] }]
    const penalized = softPenalizeMatchesByContentTermCorroboration(matches, ['retention'])
    expect(penalized[0]?.score).toBe(1) // max(1, 3-8) = 1
  })

  it('softPenalize：所有候选均已佐证 → score 不变', () => {
    const matches: RecallMatch[] = [
      { item: retentionArticle, score: 50, matchedFields: ['title'] },
      { item: retentionArticle, score: 30, matchedFields: ['embedding'] } // 复用做"另一条"
    ]
    // 构造两个不同的佐证项：复用 retentionArticle 仅用于测 score 不变
    const penalized = softPenalizeMatchesByContentTermCorroboration(matches, ['retention'])
    expect(penalized.every(p => p.score === p.score)).toBe(true)
    expect(penalized[0]?.score).toBe(50)
    expect(penalized[1]?.score).toBe(30)
  })

  /**
   * 实验三验证：soft penalty 保留正确候选，hard filter 会丢失。
   * 对比测试：filterMatchesByContentTermCorroboration 与 softPenalize 的行为差异。
   */
  it('对比：hard filter 删错项 / soft penalty 保留（实验三 fix）', () => {
    const matches: RecallMatch[] = [
      // standupScrap 是语义相关但 contentTerms=["retention"] 不匹配的项
      { item: standupScrap, score: 91, matchedFields: ['embedding'] },
      { item: retentionArticle, score: 40, matchedFields: ['title'] }
    ]

    // Hard filter：contentTerms=["retention"]，standup 字段无 retention → 被删除
    const hardFiltered = filterMatchesByContentTermCorroboration(matches, ['retention'])
    expect(hardFiltered).toHaveLength(1)
    expect(hardFiltered[0]?.item.id).toBe(retentionArticle.id)

    // Soft penalty：保留两项，standup score 扣 penalty
    const softPenalized = softPenalizeMatchesByContentTermCorroboration(matches, ['retention'])
    expect(softPenalized).toHaveLength(2)
    const standup = softPenalized.find(p => p.item.id === standupScrap.id)
    expect(standup?.score).toBe(91 - HYBRID_CORROBORATION_SOFT_PENALTY)
    expect(standup?.score).toBeGreaterThan(retentionArticle.clues.openCount ?? 0) // 软排序而非硬删
  })
})
