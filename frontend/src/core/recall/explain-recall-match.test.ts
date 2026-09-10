import { describe, expect, it } from 'vitest'

import {
  createBookmarkMemoryItem,
  createTextExcerptMemoryItem
} from '@/core/memory/create-memory-item'
import { testTranslateEn } from '@/core/i18n/test-translate-en'
import {
  explainRecallMatch,
  findMatchedClueToken,
  formatRecallClueEcho,
  getRecallMatchFieldShortLabel,
  pickPrimaryMatchedField,
  shortenClueForRetry,
  truncateRecallExplainText
} from '@/core/recall/explain-recall-match'

const baseContext = {
  ownerId: '11111111-1111-4111-8111-111111111111',
  sourceLocalProfileId: '22222222-2222-4222-8222-222222222222',
  now: () => '2026-07-22T06:00:00.000Z'
}

describe('explain-recall-match', () => {
  it('pickPrimaryMatchedField 按权重选主因', () => {
    expect(pickPrimaryMatchedField(['domain', 'title', 'url'])).toBe('title')
    expect(pickPrimaryMatchedField([])).toBeNull()
  })

  it('explainRecallMatch 生成主因与次要字段', () => {
    const item = createBookmarkMemoryItem({
      ...baseContext,
      payload: { title: 'Retention analysis report', url: 'https://example.com/retention' }
    })

    const explanation = explainRecallMatch(
      {
        clue: 'retention',
        matchedFields: ['title', 'domain'],
        item
      },
      testTranslateEn
    )

    expect(explanation.primary).toBe('title contains "retention"')
    expect(explanation.secondary).toBe('also matched: domain')
    expect(explanation.reasonLine).toBe('title contains "retention"; also matched: domain')
  })

  it('摘录命中出处页名时解释为页名而非标题', () => {
    const item = createTextExcerptMemoryItem({
      ...baseContext,
      payload: {
        selectedText: 'The order still matters',
        sourceUrl: 'https://www.gushiwen.cn/x',
        pageTitle: 'Classical poetry archive'
      }
    })

    const explanation = explainRecallMatch(
      {
        clue: 'poetry',
        matchedFields: ['pageTitle'],
        item
      },
      testTranslateEn
    )

    expect(explanation.primary).toBe('page title contains "poetry"')
    expect(explanation.primary).not.toBe('title contains "poetry"')
  })

  it('无匹配字段时回退内容相关', () => {
    expect(explainRecallMatch({ clue: 'retention', matchedFields: [] }, testTranslateEn)).toEqual({
      primary: 'content-related',
      secondary: null,
      reasonLine: 'content-related'
    })
  })

  it('约束邻域不作「字段含 clue token」误导', () => {
    const explanation = explainRecallMatch(
      {
        clue: 'video',
        matchedFields: ['constraint_neighborhood', 'outcomePair']
      },
      testTranslateEn
    )
    expect(explanation.primary).toBe('Matched as this type in your library')
    expect(explanation.primary).not.toMatch(/containing/)
    expect(explanation.secondary).toContain('outcomePair')
    expect(getRecallMatchFieldShortLabel('constraint_neighborhood', testTranslateEn)).toBe('type')
  })

  it('findMatchedClueToken 在字段文本中找更长命中 token', () => {
    const item = createBookmarkMemoryItem({
      ...baseContext,
      payload: { title: 'Product retention analysis', url: 'https://example.com/x' }
    })

    expect(
      findMatchedClueToken({
        clue: 'product retention',
        primaryField: 'title',
        item
      })
    ).toBe('product retention')
  })

  it('formatRecallClueEcho 保留中长线索（布局省略交给 CSS）', () => {
    expect(formatRecallClueEcho('retention', testTranslateEn)).toBe('Based on "retention"')
    const mid = 'product retention analysis'
    expect(formatRecallClueEcho(mid, testTranslateEn)).toBe(`Based on "${mid}"`)
  })

  it('shortenClueForRetry 缩短线索', () => {
    expect(shortenClueForRetry('retention analysis report')).toBe('retention')
    expect(shortenClueForRetry('abcdefghij')).toBe('abcdefgh')
    expect(shortenClueForRetry('x')).toBeNull()
  })

  it('truncate 工具与短标签（显式 max，非默认布局截断）', () => {
    expect(truncateRecallExplainText('a b  c', 10)).toBe('a b c')
    expect(truncateRecallExplainText('a'.repeat(20), 10).endsWith('…')).toBe(true)
    expect(getRecallMatchFieldShortLabel('textExcerpt', testTranslateEn)).toBe('excerpt')
  })

  it('explain 主因引用完整命中 token（不固定 12 字截断）', () => {
    const item = createBookmarkMemoryItem({
      ...baseContext,
      payload: { title: 'Product retention analysis', url: 'https://example.com/x' }
    })
    const explanation = explainRecallMatch(
      {
        clue: 'product retention',
        matchedFields: ['title'],
        item
      },
      testTranslateEn
    )
    expect(explanation.primary).toContain('product retention')
    expect(explanation.primary).not.toMatch(/…/)
  })
})
