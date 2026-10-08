import { describe, expect, it } from 'vitest'

import {
  createBookmarkMemoryItem,
  createTextExcerptMemoryItem
} from '@/core/memory/create-memory-item'
import { testTranslateEn } from '@/core/i18n/test-translate-en'
import {
  buildOmniboxHandoffContent,
  escapeOmniboxXml,
  formatOmniboxDefaultSuggestionDescription,
  formatOmniboxNoMatchSuggestionDescription,
  formatOmniboxPrimaryMatch,
  getOmniboxTypePrefix,
  OMNIBOX_SUGGEST_LIMIT,
  recallMatchToOmniboxSuggest,
  recallResultToOmniboxSuggests,
  truncateOmniboxText,
  tryParseHttpUrl,
  tryParseOmniboxHandoffClue
} from '@/core/recall/omnibox-suggest'
import type { RecallMatch, RecallResult } from '@/core/recall/recall-result'

const baseContext = {
  ownerId: '11111111-1111-4111-8111-111111111111',
  sourceLocalProfileId: '22222222-2222-4222-8222-222222222222',
  now: () => '2026-07-22T06:00:00.000Z'
}

const detailPageUrl = 'chrome-extension://abcdefghijklmnopqrstuvwxyzabcdef/detail.html'
const suggestOptions = { detailPageUrl, translate: testTranslateEn }

describe('omnibox-suggest', () => {
  it('handoff content 编解码往返且 ≠ 线索字面', () => {
    const content = buildOmniboxHandoffContent('jh & space')
    expect(content).not.toBe('jh & space')
    expect(tryParseOmniboxHandoffClue(content)).toBe('jh & space')
    expect(tryParseOmniboxHandoffClue('jh')).toBeNull()
  })

  it('default / no_match 文案：有真实快捷键才括号展示，禁止写死建议键', () => {
    expect(formatOmniboxDefaultSuggestionDescription('Alt+Shift+Y', testTranslateEn)).toBe(
      'Tip: Best with a title, site, or note keyword. Fuzzy clues → Side Panel (Alt+Shift+Y)'
    )
    expect(formatOmniboxDefaultSuggestionDescription('', testTranslateEn)).toBe(
      'Tip: Best with a title, site, or note keyword. Fuzzy clues → Side Panel'
    )
    expect(formatOmniboxDefaultSuggestionDescription(null, testTranslateEn)).toBe(
      'Tip: Best with a title, site, or note keyword. Fuzzy clues → Side Panel'
    )
    expect(formatOmniboxNoMatchSuggestionDescription('Ctrl+Shift+Y', testTranslateEn)).toBe(
      'No quick match — click to recall this in Side Panel (Ctrl+Shift+Y)'
    )
    expect(formatOmniboxNoMatchSuggestionDescription('  ', testTranslateEn)).toBe(
      'No quick match — click to recall this in Side Panel'
    )
  })

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
    expect(tryParseHttpUrl('retention-analysis')).toBeNull()
  })

  it('类型前缀区分书签与摘录', () => {
    expect(getOmniboxTypePrefix('bookmark', testTranslateEn)).toBe('Bookmark')
    expect(getOmniboxTypePrefix('text_excerpt', testTranslateEn)).toBe('Excerpt')
  })

  it('formatOmniboxPrimaryMatch 只取首字段短标签', () => {
    expect(formatOmniboxPrimaryMatch(['title', 'domain', 'url'], testTranslateEn)).toBe('title')
    expect(formatOmniboxPrimaryMatch(['textExcerpt'], testTranslateEn)).toBe('excerpt')
    expect(formatOmniboxPrimaryMatch([], testTranslateEn)).toBeNull()
  })

  it('书签建议：Chrome 式标题 — host + 紧凑 ECS 尾缀', () => {
    const match: RecallMatch = {
      item: createBookmarkMemoryItem({
        ...baseContext,
        payload: { title: 'Retention analysis', url: 'https://example.com/retention' }
      }),
      score: 40,
      matchedFields: ['title', 'domain', 'url']
    }

    const suggest = recallMatchToOmniboxSuggest(match, suggestOptions)
    expect(suggest?.content).toContain('/omnibox-open.html?id=')
    expect(suggest?.content).toContain(match.item.id)
    expect(suggest?.description).toContain('<match>Retention analysis</match>')
    expect(suggest?.description).toContain('<url>example.com</url>')
    expect(suggest?.description).toContain('Bookmark')
    expect(suggest?.description).toMatch(/ago|just now|Saved/i)
    expect(suggest?.description).toContain('title')
    // 不再堆长句 Explain / Y· 前缀
    expect(suggest?.description).not.toContain('Y·Bookmark')
    expect(suggest?.description).not.toContain('Found')
    expect(suggest?.description).not.toContain('匹配：')
  })

  it('摘录建议优先页名，不堆长句 Explain', () => {
    const match: RecallMatch = {
      item: createTextExcerptMemoryItem({
        ...baseContext,
        payload: {
          selectedText: 'Key retention metrics overview for day-one and day-seven return visits.',
          sourceUrl: 'https://notes.example.com/post',
          pageTitle: 'Growth notes'
        }
      }),
      score: 36,
      matchedFields: ['textExcerpt']
    }

    const suggest = recallMatchToOmniboxSuggest(match, {
      ...suggestOptions,
      clue: 'retention metrics'
    })
    expect(suggest?.description).toContain('<match>Growth notes</match>')
    expect(suggest?.description).toContain('<url>notes.example.com</url>')
    expect(suggest?.description).toContain('Excerpt')
    expect(suggest?.description).toContain('excerpt')
    expect(suggest?.description).not.toContain('Found')
    expect(suggest?.description).not.toContain('Key retention metrics overview')
  })

  it('摘录无页名时退回正文锚点', () => {
    const match: RecallMatch = {
      item: createTextExcerptMemoryItem({
        ...baseContext,
        payload: {
          selectedText: 'Key retention metrics overview for day-one and day-seven return visits.',
          sourceUrl: 'https://notes.example.com/post',
          pageTitle: ''
        }
      }),
      score: 36,
      matchedFields: ['textExcerpt']
    }

    const suggest = recallMatchToOmniboxSuggest(match, suggestOptions)
    expect(suggest?.content).toContain('/detail.html?id=')
    expect(suggest?.content).toContain(match.item.id)
    expect(suggest?.description).toContain('Excerpt')
    expect(suggest?.description).toContain('<match>Key retention metrics overview')
    expect(suggest?.description).toContain('notes.example.com')
  })

  it('recallResultToOmniboxSuggests 输出 Top Pick + Also Possible', () => {
    const top: RecallMatch = {
      item: createBookmarkMemoryItem({
        ...baseContext,
        payload: { title: 'Retention analysis', url: 'https://example.com/retention' }
      }),
      score: 40,
      matchedFields: ['title']
    }
    const also: RecallMatch = {
      item: createBookmarkMemoryItem({
        ...baseContext,
        payload: { title: 'Retention handbook', url: 'https://example.com/guide' }
      }),
      score: 20,
      matchedFields: ['title']
    }

    const result: RecallResult = {
      outcome: 'top_pick',
      topPick: top,
      alsoPossible: [also],
      clue: 'retention'
    }

    const suggests = recallResultToOmniboxSuggests(result, suggestOptions)
    expect(suggests).toHaveLength(2)
    expect(suggests[0]?.content).toContain('/omnibox-open.html?id=')
    expect(suggests[0]?.content).toContain(result.topPick!.item.id)
    expect(suggests[0]?.description).toContain('Bookmark')
    expect(suggests[1]?.content).toContain('/omnibox-open.html?id=')
    expect(suggests[1]?.content).toContain(result.alsoPossible[0]!.item.id)
  })

  it('相同 URL 去重', () => {
    const item = createBookmarkMemoryItem({
      ...baseContext,
      payload: { title: 'Same page', url: 'https://example.com/same' }
    })
    const match: RecallMatch = { item, score: 40, matchedFields: ['title'] }
    const result: RecallResult = {
      outcome: 'top_pick',
      topPick: match,
      alsoPossible: [{ ...match, score: 10 }],
      clue: 'same'
    }

    expect(recallResultToOmniboxSuggests(result, suggestOptions)).toHaveLength(1)
  })

  it(`建议条数不超过 OMNIBOX_SUGGEST_LIMIT（${OMNIBOX_SUGGEST_LIMIT}），且与 Side Panel 首屏页长解耦`, () => {
    const overLimit = OMNIBOX_SUGGEST_LIMIT + 2
    const matches: RecallMatch[] = Array.from({ length: overLimit }, (_, i) => ({
      item: createBookmarkMemoryItem({
        ...baseContext,
        payload: {
          title: `High match ${i + 1}`,
          url: `https://example.com/match-${i + 1}`
        }
      }),
      score: 100 - i,
      matchedFields: ['title']
    }))
    const [topPick, ...alsoPossible] = matches
    const result: RecallResult = {
      outcome: 'top_pick',
      topPick,
      alsoPossible,
      clue: 'match'
    }

    const suggests = recallResultToOmniboxSuggests(result, suggestOptions)
    expect(suggests).toHaveLength(OMNIBOX_SUGGEST_LIMIT)
    // 当前 Normative：一次性下拉预算 6；Side Panel 首屏仍为 RECALL_RESULT_PAGE_SIZE=5
    expect(OMNIBOX_SUGGEST_LIMIT).toBe(6)
  })

  it('折叠组在 description 中带 similar 计数', () => {
    const item = createBookmarkMemoryItem({
      ...baseContext,
      payload: { title: 'Duplicate bookmark', url: 'https://example.com/dup' }
    })
    const sibling = createBookmarkMemoryItem({
      ...baseContext,
      payload: { title: 'Duplicate bookmark copy', url: 'https://example.com/dup' }
    })
    const match: RecallMatch = {
      item,
      score: 40,
      matchedFields: ['title'],
      duplicateGroup: {
        totalCount: 3,
        siblings: [{ item: sibling, score: 30, matchedFields: ['title'] }]
      }
    }

    const suggest = recallMatchToOmniboxSuggest(match, suggestOptions)
    expect(suggest?.description).toContain('3 similar')
  })

  it('无 URL 的命中被跳过', () => {
    const item = createBookmarkMemoryItem({
      ...baseContext,
      payload: { title: 'Empty link', url: 'https://example.com/x' }
    })
    item.payload.url = '   '
    const match: RecallMatch = { item, score: 40, matchedFields: ['title'] }
    expect(recallMatchToOmniboxSuggest(match, suggestOptions)).toBeNull()
  })
})
