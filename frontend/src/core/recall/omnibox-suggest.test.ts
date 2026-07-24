import { describe, expect, it } from 'vitest'

import {
  createBookmarkMemoryItem,
  createTextExcerptMemoryItem
} from '@/core/memory/create-memory-item'
import {
  escapeOmniboxXml,
  formatOmniboxPrimaryMatch,
  getOmniboxTypePrefix,
  recallMatchToOmniboxSuggest,
  recallResultToOmniboxSuggests,
  truncateOmniboxText,
  tryParseHttpUrl
} from '@/core/recall/omnibox-suggest'
import type { RecallMatch, RecallResult } from '@/core/recall/recall-result'

const baseContext = {
  ownerId: '11111111-1111-4111-8111-111111111111',
  sourceLocalProfileId: '22222222-2222-4222-8222-222222222222',
  now: () => '2026-07-22T06:00:00.000Z'
}

const detailPageUrl = 'chrome-extension://abcdefghijklmnopqrstuvwxyzabcdef/detail.html'
const suggestOptions = { detailPageUrl }

describe('omnibox-suggest', () => {
  it('escapeOmniboxXml 转义预定义实体', () => {
    expect(escapeOmniboxXml(`A & B <C> "D" 'E'`)).toBe(
      'A &amp; B &lt;C&gt; &quot;D&quot; &apos;E&apos;'
    )
  })

  it('truncateOmniboxText 压缩空白并截断', () => {
    expect(truncateOmniboxText('  a   b  ', 10)).toBe('a b')
    expect(truncateOmniboxText('abcdefghij', 5)).toBe('abcd…')
  })

  it('tryParseHttpUrl 仅接受 http(s)', () => {
    expect(tryParseHttpUrl('https://example.com/a')).toBe('https://example.com/a')
    expect(tryParseHttpUrl('javascript:alert(1)')).toBeNull()
    expect(tryParseHttpUrl('留存分析')).toBeNull()
  })

  it('类型前缀区分书签与摘录', () => {
    expect(getOmniboxTypePrefix('bookmark')).toBe('Y·书签')
    expect(getOmniboxTypePrefix('text_excerpt')).toBe('Y·摘录')
  })

  it('formatOmniboxPrimaryMatch 只取首字段短标签', () => {
    expect(formatOmniboxPrimaryMatch(['title', 'domain', 'url'])).toBe('标题')
    expect(formatOmniboxPrimaryMatch(['textExcerpt'])).toBe('正文')
    expect(formatOmniboxPrimaryMatch([])).toBeNull()
  })

  it('书签建议带 Y·书签 前缀与短命中', () => {
    const match: RecallMatch = {
      item: createBookmarkMemoryItem({
        ...baseContext,
        payload: { title: '留存分析', url: 'https://example.com/retention' }
      }),
      score: 40,
      matchedFields: ['title', 'domain', 'url']
    }

    const suggest = recallMatchToOmniboxSuggest(match, suggestOptions)
    expect(suggest?.content).toBe('https://example.com/retention')
    expect(suggest?.description).toBe(
      '<dim>Y·书签</dim> <match>留存分析</match> <dim>·</dim> <url>example.com</url> <dim>· 标题</dim>'
    )
    expect(suggest?.description).not.toContain('匹配：')
  })

  it('摘录建议 content 指向详情页', () => {
    const match: RecallMatch = {
      item: createTextExcerptMemoryItem({
        ...baseContext,
        payload: {
          selectedText: '关键留存指标说明，用于衡量次日与七日回访。',
          sourceUrl: 'https://notes.example.com/post',
          pageTitle: '增长笔记'
        }
      }),
      score: 36,
      matchedFields: ['textExcerpt']
    }

    const suggest = recallMatchToOmniboxSuggest(match, suggestOptions)
    expect(suggest?.content).toContain('/detail.html?id=')
    expect(suggest?.content).toContain(match.item.id)
    expect(suggest?.description).toContain('<dim>Y·摘录</dim>')
    expect(suggest?.description).toContain(
      '<match>关键留存指标说明，用于衡量次日与七日回访。</match>'
    )
    expect(suggest?.description).toContain('增长笔记 · notes.example.com')
    expect(suggest?.description).not.toContain('「')
  })

  it('recallResultToOmniboxSuggests 输出 Top Pick + Also Possible', () => {
    const top: RecallMatch = {
      item: createBookmarkMemoryItem({
        ...baseContext,
        payload: { title: '留存分析', url: 'https://example.com/retention' }
      }),
      score: 40,
      matchedFields: ['title']
    }
    const also: RecallMatch = {
      item: createBookmarkMemoryItem({
        ...baseContext,
        payload: { title: '留存手册', url: 'https://example.com/guide' }
      }),
      score: 20,
      matchedFields: ['title']
    }

    const result: RecallResult = {
      outcome: 'top_pick',
      topPick: top,
      alsoPossible: [also],
      clue: '留存'
    }

    const suggests = recallResultToOmniboxSuggests(result, suggestOptions)
    expect(suggests).toHaveLength(2)
    expect(suggests[0]?.content).toBe('https://example.com/retention')
    expect(suggests[0]?.description).toContain('Y·书签')
    expect(suggests[1]?.content).toBe('https://example.com/guide')
  })

  it('相同 URL 去重', () => {
    const item = createBookmarkMemoryItem({
      ...baseContext,
      payload: { title: '同一页', url: 'https://example.com/same' }
    })
    const match: RecallMatch = { item, score: 40, matchedFields: ['title'] }
    const result: RecallResult = {
      outcome: 'top_pick',
      topPick: match,
      alsoPossible: [{ ...match, score: 10 }],
      clue: '同一'
    }

    expect(recallResultToOmniboxSuggests(result, suggestOptions)).toHaveLength(1)
  })

  it('无 URL 的命中被跳过', () => {
    const item = createBookmarkMemoryItem({
      ...baseContext,
      payload: { title: '空链', url: 'https://example.com/x' }
    })
    item.payload.url = '   '
    const match: RecallMatch = { item, score: 40, matchedFields: ['title'] }
    expect(recallMatchToOmniboxSuggest(match, suggestOptions)).toBeNull()
  })
})
