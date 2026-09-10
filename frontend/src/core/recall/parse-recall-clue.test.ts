import { describe, expect, it } from 'vitest'

import {
  extractContentTerms,
  parseRecallClue,
  resolveRelativeTimeRange,
  timeConfidenceForRelativeLabel
} from '@/core/recall/parse-recall-clue'

/** 固定时钟：2026-07-28 正午 UTC，便于断言时间窗。 */
const NOW_MS = Date.parse('2026-07-28T12:00:00.000Z')

describe('resolveRelativeTimeRange', () => {
  it('yesterday 落在 UTC 日历日闭区间', () => {
    expect(resolveRelativeTimeRange('yesterday', NOW_MS)).toEqual({
      from: '2026-07-27T00:00:00.000Z',
      to: '2026-07-27T23:59:59.999Z',
      label: 'yesterday'
    })
  })

  it('day before yesterday 落在前天', () => {
    expect(resolveRelativeTimeRange('day_before_yesterday', NOW_MS)).toEqual({
      from: '2026-07-26T00:00:00.000Z',
      to: '2026-07-26T23:59:59.999Z',
      label: 'day_before_yesterday'
    })
  })

  it('last_month 约 2–6 周滚动窗', () => {
    expect(resolveRelativeTimeRange('last_month', NOW_MS)).toEqual({
      from: '2026-05-29T00:00:00.000Z',
      to: '2026-07-13T23:59:59.999Z',
      label: 'last_month'
    })
  })

  it('few_months_ago 约 1.5–6 个月滚动窗', () => {
    expect(resolveRelativeTimeRange('few_months_ago', NOW_MS)).toEqual({
      from: '2026-01-29T00:00:00.000Z',
      to: '2026-06-12T23:59:59.999Z',
      label: 'few_months_ago'
    })
  })
})

describe('timeConfidenceForRelativeLabel', () => {
  it('日历级 label 为 high', () => {
    expect(timeConfidenceForRelativeLabel('yesterday')).toBe('high')
    expect(timeConfidenceForRelativeLabel('last_week')).toBe('high')
    expect(timeConfidenceForRelativeLabel('last_month')).toBe('high')
  })

  it('糊时间 label 为 low', () => {
    expect(timeConfidenceForRelativeLabel('a_while_ago')).toBe('low')
    expect(timeConfidenceForRelativeLabel('few_months_ago')).toBe('low')
    expect(timeConfidenceForRelativeLabel('long_ago')).toBe('low')
    expect(timeConfidenceForRelativeLabel('recent')).toBe('low')
  })
})

describe('extractContentTerms', () => {
  it('extracts mixed Latin tokens and path-like fragments', () => {
    expect(extractContentTerms('  Li Bai RAG docs/api ')).toEqual(['li', 'bai', 'rag', 'docs/api'])
  })
})

describe('parseRecallClue', () => {
  it('空线索 → low + 无词', () => {
    expect(parseRecallClue('   ', { nowMs: NOW_MS })).toEqual({
      raw: '',
      contentTerms: [],
      confidence: 'low'
    })
  })

  it('yesterday + poem + Li Bai → high', () => {
    const parsed = parseRecallClue('i yesterday saved a poem about Li Bai', { nowMs: NOW_MS })
    expect(parsed.timeRange?.label).toBe('yesterday')
    expect(parsed.objectTypes).toEqual(['poem'])
    expect(parsed.contentTerms).toEqual(expect.arrayContaining(['li', 'bai']))
    expect(parsed.confidence).toBe('high')
  })

  it('day before yesterday + article + RAG → high', () => {
    const parsed = parseRecallClue('day before yesterday the article about RAG', { nowMs: NOW_MS })
    expect(parsed.timeRange?.label).toBe('day_before_yesterday')
    expect(parsed.objectTypes).toEqual(['article'])
    expect(parsed.contentTerms).toEqual(expect.arrayContaining(['rag']))
    expect(parsed.confidence).toBe('high')
  })

  it("a while ago + didn't finish reading + article → medium（无内容词）", () => {
    const parsed = parseRecallClue("the article I didn't finish reading a while ago", {
      nowMs: NOW_MS
    })
    expect(parsed.timeRange?.label).toBe('a_while_ago')
    expect(parsed.behaviorHints).toEqual(['half_read'])
    expect(parsed.objectTypes).toEqual(['article'])
    expect(parsed.contentTerms).toEqual([])
    expect(parsed.confidence).toBe('medium')
  })

  it('a few days ago / the other day → recent（含近几天，勿误入 a_while_ago）', () => {
    expect(
      parseRecallClue('the privacy article from a few days ago', { nowMs: NOW_MS }).timeRange?.label
    ).toBe('recent')
    expect(
      parseRecallClue('that poem from the other day', { nowMs: NOW_MS }).timeRange?.label
    ).toBe('recent')
  })

  it('a few months back / last month → month 级标签（勿并入 a_while_ago）', () => {
    expect(
      parseRecallClue('something about public libraries i saved a few months back', {
        nowMs: NOW_MS
      }).timeRange?.label
    ).toBe('few_months_ago')
    expect(
      parseRecallClue('an article i saved last month about remote work', {
        nowMs: NOW_MS
      }).timeRange?.label
    ).toBe('last_month')
    expect(
      parseRecallClue('that page from a while back about caching', {
        nowMs: NOW_MS
      }).timeRange?.label
    ).toBe('few_months_ago')
  })

  it('some time ago / a long time ago → 闭集 label + low confidence', () => {
    const whileAgo = parseRecallClue('the excerpts i saved some time ago', { nowMs: NOW_MS })
    expect(whileAgo.timeRange?.label).toBe('a_while_ago')
    expect(whileAgo.timeConfidence).toBe('low')

    const longAgo = parseRecallClue('a bookmark from a long time ago', { nowMs: NOW_MS })
    expect(longAgo.timeRange?.label).toBe('long_ago')
    expect(longAgo.timeConfidence).toBe('low')

    const lastWeek = parseRecallClue('the bookmarks i saved last week', { nowMs: NOW_MS })
    expect(lastWeek.timeRange?.label).toBe('last_week')
    expect(lastWeek.timeConfidence).toBe('high')
  })

  it('left a note + page + deployment → high', () => {
    const parsed = parseRecallClue('yesterday left a note about the deployment page', {
      nowMs: NOW_MS
    })
    expect(parsed.noteHint).toBe(true)
    expect(parsed.objectTypes).toEqual(['page'])
    expect(parsed.contentTerms).toEqual(expect.arrayContaining(['deployment']))
    expect(parsed.confidence).toBe('high')
  })

  it('played on repeat + song + yesterday → medium', () => {
    const parsed = parseRecallClue('the song I played on repeat yesterday', { nowMs: NOW_MS })
    expect(parsed.timeRange?.label).toBe('yesterday')
    expect(parsed.behaviorHints).toEqual(['often_opened'])
    expect(parsed.objectTypes).toEqual(['song'])
    expect(parsed.confidence).toBe('medium')
  })

  it('the article I read last week → medium（时间+类型，read 为 filler）', () => {
    const parsed = parseRecallClue('the article I read last week', { nowMs: NOW_MS })
    expect(parsed.timeRange?.label).toBe('last_week')
    expect(parsed.objectTypes).toEqual(['article'])
    expect(parsed.contentTerms).toEqual([])
    expect(parsed.confidence).toBe('medium')
  })

  it('last week + code → high', () => {
    const parsed = parseRecallClue('last week saved code deployment', { nowMs: NOW_MS })
    expect(parsed.timeRange?.label).toBe('last_week')
    expect(parsed.objectTypes).toEqual(['code'])
    expect(parsed.contentTerms).toEqual(expect.arrayContaining(['deployment']))
    expect(parsed.confidence).toBe('high')
  })

  it('command type → medium', () => {
    const parsed = parseRecallClue('env sync command', { nowMs: NOW_MS })
    expect(parsed.objectTypes).toEqual(['command'])
    expect(parsed.contentTerms).toEqual(expect.arrayContaining(['env', 'sync']))
    expect(parsed.confidence).toBe('medium')
  })

  it('recently + just saved + password → medium', () => {
    const parsed = parseRecallClue('recently just saved password', { nowMs: NOW_MS })
    expect(parsed.timeRange?.label).toBe('recent')
    expect(parsed.objectTypes).toEqual(['password'])
    expect(parsed.behaviorHints).toEqual(['recently_saved'])
    expect(parsed.confidence).toBe('medium')
  })

  it('long ago + poem → medium', () => {
    const parsed = parseRecallClue('long ago a poem', { nowMs: NOW_MS })
    expect(parsed.timeRange?.label).toBe('long_ago')
    expect(parsed.objectTypes).toEqual(['poem'])
    expect(parsed.contentTerms).toEqual([])
    expect(parsed.confidence).toBe('medium')
  })

  it('yesterday + poem about Li Bai (english) → high', () => {
    const parsed = parseRecallClue('yesterday poem about Li Bai', { nowMs: NOW_MS })
    expect(parsed.timeRange?.label).toBe('yesterday')
    expect(parsed.objectTypes).toEqual(['poem'])
    expect(parsed.contentTerms).toEqual(expect.arrayContaining(['li', 'bai']))
    expect(parsed.confidence).toBe('high')
  })

  it('pure keywords → low', () => {
    const parsed = parseRecallClue('Cloudflare Workers', { nowMs: NOW_MS })
    expect(parsed.timeRange).toBeUndefined()
    expect(parsed.objectTypes).toBeUndefined()
    expect(parsed.contentTerms).toEqual(['cloudflare', 'workers'])
    expect(parsed.confidence).toBe('low')
  })

  it('only time anchor (no content terms) → low', () => {
    const parsed = parseRecallClue('yesterday saved that', { nowMs: NOW_MS })
    expect(parsed.timeRange?.label).toBe('yesterday')
    expect(parsed.contentTerms).toEqual([])
    expect(parsed.confidence).toBe('low')
  })

  it('only object type → low', () => {
    const parsed = parseRecallClue('poem', { nowMs: NOW_MS })
    expect(parsed.objectTypes).toEqual(['poem'])
    expect(parsed.contentTerms).toEqual([])
    expect(parsed.confidence).toBe('low')
  })

  it('just saved + article → medium', () => {
    const parsed = parseRecallClue('just saved article', { nowMs: NOW_MS })
    expect(parsed.behaviorHints).toEqual(['recently_saved'])
    expect(parsed.objectTypes).toEqual(['article'])
    expect(parsed.confidence).toBe('medium')
  })

  it('The recently collected bookmark → recent + bookmark，无 collected 内容词', () => {
    const parsed = parseRecallClue('The recently collected bookmark', { nowMs: NOW_MS })
    expect(parsed.timeRange?.label).toBe('recent')
    expect(parsed.objectTypes).toEqual(['bookmark'])
    expect(parsed.behaviorHints).toEqual(['recently_saved'])
    expect(parsed.contentTerms).toEqual([])
    expect(parsed.confidence).toBe('medium')
  })

  it('just saved bookmark / just bookmarked → 无虚词残留', () => {
    for (const clue of ['just saved bookmark', 'just bookmarked']) {
      const parsed = parseRecallClue(clue, { nowMs: NOW_MS })
      expect(parsed.objectTypes).toEqual(['bookmark'])
      expect(parsed.behaviorHints).toEqual(['recently_saved'])
      expect(parsed.contentTerms).toEqual([])
    }
  })

  it('half read + article → medium（兼容旧说法）', () => {
    const parsed = parseRecallClue('half read the article', { nowMs: NOW_MS })
    expect(parsed.behaviorHints).toEqual(['half_read'])
    expect(parsed.objectTypes).toEqual(['article'])
    expect(parsed.confidence).toBe('medium')
  })

  it("didn't finish reading + article → medium", () => {
    const parsed = parseRecallClue("the article I didn't finish reading", { nowMs: NOW_MS })
    expect(parsed.behaviorHints).toEqual(['half_read'])
    expect(parsed.objectTypes).toEqual(['article'])
    expect(parsed.confidence).toBe('medium')
  })

  it('quote type → medium', () => {
    const parsed = parseRecallClue('yesterday the quote', { nowMs: NOW_MS })
    expect(parsed.timeRange?.label).toBe('yesterday')
    expect(parsed.objectTypes).toEqual(['quote'])
    expect(parsed.contentTerms).toEqual([])
    expect(parsed.confidence).toBe('medium')
  })

  it('zero-anchor natural phrase stays low', () => {
    const parsed = parseRecallClue('i feel bored', { nowMs: NOW_MS })
    expect(parsed.timeRange).toBeUndefined()
    expect(parsed.objectTypes).toBeUndefined()
    expect(parsed.noteHint).toBeUndefined()
    expect(parsed.confidence).toBe('low')
    expect(parsed.contentTerms.length).toBeGreaterThan(0)
  })

  it('put a few songs i like → song type detected, still not high', () => {
    const parsed = parseRecallClue('put a few songs i like', { nowMs: NOW_MS })
    expect(parsed.objectTypes).toEqual(['song'])
    expect(parsed.contentTerms).toEqual(expect.arrayContaining(['like']))
    expect(parsed.confidence).toBe('medium')
  })

  it('long phrase detection priority: poetry → poem', () => {
    const parsed = parseRecallClue('poetry about Li Bai', { nowMs: NOW_MS })
    expect(parsed.objectTypes).toEqual(['poem'])
    expect(parsed.contentTerms).toEqual(expect.arrayContaining(['li', 'bai']))
  })

  it('wwii related video → video + wwii', () => {
    const parsed = parseRecallClue('wwii related video', { nowMs: NOW_MS })
    expect(parsed.objectTypes).toEqual(['video'])
    expect(parsed.contentTerms).toEqual(['wwii'])
    expect(parsed.confidence).toBe('medium')
  })

  it('wwii related video → video + wwii', () => {
    const parsed = parseRecallClue('wwii related video', { nowMs: NOW_MS })
    expect(parsed.objectTypes).toEqual(['video'])
    expect(parsed.contentTerms).toEqual(['wwii'])
    expect(parsed.confidence).toBe('medium')
  })

  it('movie synonyms map to video', () => {
    expect(parseRecallClue('the movie I watched yesterday', { nowMs: NOW_MS }).objectTypes).toEqual(
      ['video']
    )
    expect(parseRecallClue('the film I watched yesterday', { nowMs: NOW_MS }).objectTypes).toEqual([
      'video'
    ])
  })

  it('watched / videos 作 filler，检索回退 objectType', () => {
    const parsed = parseRecallClue('The video I watched yesterday', { nowMs: NOW_MS })
    expect(parsed.timeRange?.label).toBe('yesterday')
    expect(parsed.objectTypes).toEqual(['video'])
    expect(parsed.contentTerms).toEqual([])
  })
})
