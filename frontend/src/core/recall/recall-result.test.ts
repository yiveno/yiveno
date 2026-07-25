import { describe, expect, it } from 'vitest'

import {
  createBookmarkMemoryItem,
  createTextExcerptMemoryItem
} from '@/core/memory/create-memory-item'
import { testTranslateZh } from '@/core/i18n/test-translate-zh'
import {
  formatExcerptProvenance,
  formatMatchedFields,
  getMemoryItemDisplay
} from '@/core/recall/recall-result'

const baseContext = {
  ownerId: '11111111-1111-4111-8111-111111111111',
  sourceLocalProfileId: '22222222-2222-4222-8222-222222222222',
  now: () => '2026-07-24T10:00:00.000Z'
}

describe('formatMatchedFields', () => {
  it('无线索时退化为字段名列表', () => {
    expect(formatMatchedFields(['title', 'domain'], testTranslateZh)).toBe('匹配：标题、域名')
    expect(formatMatchedFields([], testTranslateZh)).toBe('内容相关')
  })

  it('有线索时委托 explainRecallMatch', () => {
    expect(formatMatchedFields(['title'], testTranslateZh, '留存')).toContain('因标题')
  })
})

describe('getMemoryItemDisplay', () => {
  it('书签以书签名为主标题', () => {
    const item = createBookmarkMemoryItem({
      ...baseContext,
      payload: { title: '留存分析', url: 'https://example.com/retention' }
    })
    expect(getMemoryItemDisplay(item, testTranslateZh)).toMatchObject({
      title: '留存分析',
      subtitle: 'example.com',
      typeLabel: '书签'
    })
  })

  it('摘录无标题，正文为主，页名为出处', () => {
    const item = createTextExcerptMemoryItem({
      ...baseContext,
      payload: {
        selectedText: '关键留存指标说明',
        sourceUrl: 'https://notes.example.com/post',
        pageTitle: '增长笔记'
      }
    })
    expect(getMemoryItemDisplay(item, testTranslateZh)).toEqual({
      title: '',
      subtitle: '增长笔记 · notes.example.com',
      url: 'https://notes.example.com/post',
      excerpt: '关键留存指标说明',
      typeLabel: '文字片段'
    })
  })
})

describe('formatExcerptProvenance', () => {
  it('拼页名与域名', () => {
    expect(formatExcerptProvenance('增长笔记', 'notes.example.com')).toBe(
      '增长笔记 · notes.example.com'
    )
  })

  it('缺页名时仅域名', () => {
    expect(formatExcerptProvenance('', 'notes.example.com')).toBe('notes.example.com')
  })
})
