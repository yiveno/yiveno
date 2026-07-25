import { describe, expect, it } from 'vitest'

import { createBookmarkMemoryItem } from '@/core/memory/create-memory-item'
import { testTranslateZh } from '@/core/i18n/test-translate-zh'
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
      payload: { title: '留存分析报告', url: 'https://example.com/retention' }
    })

    const explanation = explainRecallMatch(
      {
        clue: '留存',
        matchedFields: ['title', 'domain'],
        item
      },
      testTranslateZh
    )

    expect(explanation.primary).toBe('因标题含「留存」')
    expect(explanation.secondary).toBe('还匹配：域名')
    expect(explanation.reasonLine).toBe('因标题含「留存」；还匹配：域名')
  })

  it('无匹配字段时回退内容相关', () => {
    expect(explainRecallMatch({ clue: '留存', matchedFields: [] }, testTranslateZh)).toEqual({
      primary: '内容相关',
      secondary: null,
      reasonLine: '内容相关'
    })
  })

  it('findMatchedClueToken 在字段文本中找更长命中 token', () => {
    const item = createBookmarkMemoryItem({
      ...baseContext,
      payload: { title: '产品留存分析', url: 'https://example.com/x' }
    })

    expect(
      findMatchedClueToken({
        clue: '产品 留存',
        primaryField: 'title',
        item
      })
    ).toBe('产品')
  })

  it('formatRecallClueEcho 截断线索', () => {
    expect(formatRecallClueEcho('留存', testTranslateZh)).toBe('根据线索「留存」')
    expect(formatRecallClueEcho('a'.repeat(30), testTranslateZh).length).toBeLessThan(40)
  })

  it('shortenClueForRetry 缩短线索', () => {
    expect(shortenClueForRetry('留存 分析 报告')).toBe('留存')
    expect(shortenClueForRetry('abcdefghij')).toBe('abcdefgh')
    expect(shortenClueForRetry('短')).toBeNull()
  })

  it('truncate 与短标签', () => {
    expect(truncateRecallExplainText('a b  c', 10)).toBe('a b c')
    expect(getRecallMatchFieldShortLabel('textExcerpt', testTranslateZh)).toBe('正文')
  })
})
