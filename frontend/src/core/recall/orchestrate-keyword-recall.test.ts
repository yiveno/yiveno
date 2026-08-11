import { describe, expect, it } from 'vitest'

import {
  RECALL_ORCHESTRATION_OBJECT_TYPE_BOOST,
  applyParsedClueScoreBoosts,
  buildSearchClueFromParsed,
  memoryItemInTimeRange,
  memoryItemMatchesObjectType,
  recallByKeywordWithParsedClue
} from '@/core/recall/orchestrate-keyword-recall'
import { parseRecallClue } from '@/core/recall/parse-recall-clue'
import { recallByKeyword } from '@/core/recall/build-recall-result'
import {
  createBookmarkMemoryItem,
  createTextExcerptMemoryItem
} from '@/core/memory/create-memory-item'

const OWNER = '11111111-1111-4111-8111-111111111111'
const PROFILE = '22222222-2222-4222-8222-222222222222'
const NOW_MS = Date.parse('2026-07-28T12:00:00.000Z')

describe('buildSearchClueFromParsed', () => {
  it('优先用 contentTerms', () => {
    const parsed = parseRecallClue('yesterday saved a poem about Li Bai', { nowMs: NOW_MS })
    expect(buildSearchClueFromParsed(parsed)).toBe('li bai')
  })

  it('无 contentTerms 时回退到对象类型词面（canonical English）', () => {
    const parsed = parseRecallClue("the article I didn't finish reading a while ago", {
      nowMs: NOW_MS
    })
    expect(parsed.contentTerms).toEqual([])
    expect(buildSearchClueFromParsed(parsed)).toBe('article')
  })

  it('topic alias expansion keeps wwii canonical surfaces', () => {
    const parsed = parseRecallClue('wwii related video', { nowMs: NOW_MS })
    expect(buildSearchClueFromParsed(parsed)).toBe('wwii world war ii')
  })
})

describe('memoryItemInTimeRange / objectType', () => {
  it('按 createdAt / lastOpenedAt 判断时间窗', () => {
    const parsed = parseRecallClue('yesterday poem', { nowMs: NOW_MS })
    const inRange = createTextExcerptMemoryItem({
      ownerId: OWNER,
      sourceLocalProfileId: PROFILE,
      now: () => '2026-07-27T08:00:00.000Z',
      payload: {
        selectedText: 'Li Bai poem',
        sourceUrl: 'https://poem.example/li',
        pageTitle: 'Li Bai'
      }
    })
    const outOfRange = createTextExcerptMemoryItem({
      ownerId: OWNER,
      sourceLocalProfileId: PROFILE,
      now: () => '2026-07-20T08:00:00.000Z',
      payload: {
        selectedText: 'Li Bai poem',
        sourceUrl: 'https://poem.example/old',
        pageTitle: 'Old poem'
      }
    })

    expect(parsed.timeRange).toBeDefined()
    expect(memoryItemInTimeRange(inRange, parsed.timeRange!)).toBe(true)
    expect(memoryItemInTimeRange(outOfRange, parsed.timeRange!)).toBe(false)
  })

  it('tags slug 或正文含类型词可匹配 objectType', () => {
    const tagged = createBookmarkMemoryItem({
      ownerId: OWNER,
      sourceLocalProfileId: PROFILE,
      payload: { title: 'Note', url: 'https://example.com/a' },
      clues: { tags: ['poem'] }
    })
    const titled = createBookmarkMemoryItem({
      ownerId: OWNER,
      sourceLocalProfileId: PROFILE,
      payload: { title: 'Li Bai poem', url: 'https://example.com/b' }
    })

    expect(memoryItemMatchesObjectType(tagged, 'poem')).toBe(true)
    expect(memoryItemMatchesObjectType(titled, 'poem')).toBe(true)
  })
})

describe('applyParsedClueScoreBoosts', () => {
  it('时间窗内条目不再靠时间软加成（已硬过滤）；类型仍可加成', () => {
    const parsed = parseRecallClue('yesterday Li Bai poem', { nowMs: NOW_MS })
    const item = createTextExcerptMemoryItem({
      ownerId: OWNER,
      sourceLocalProfileId: PROFILE,
      now: () => '2026-07-27T10:00:00.000Z',
      payload: {
        selectedText: 'Li Bai poem',
        sourceUrl: 'https://poem.example/x',
        pageTitle: 'poem'
      }
    })
    const boosted = applyParsedClueScoreBoosts(
      { item, score: 20, matchedFields: ['textExcerpt'] },
      parsed
    )
    expect(boosted.score).toBe(20 + RECALL_ORCHESTRATION_OBJECT_TYPE_BOOST)
  })

  it('零分不加结构化加成', () => {
    const parsed = parseRecallClue('yesterday poem', { nowMs: NOW_MS })
    const item = createTextExcerptMemoryItem({
      ownerId: OWNER,
      sourceLocalProfileId: PROFILE,
      now: () => '2026-07-27T10:00:00.000Z',
      payload: {
        selectedText: 'irrelevant',
        sourceUrl: 'https://poem.example/y',
        pageTitle: 'poem'
      }
    })
    const boosted = applyParsedClueScoreBoosts({ item, score: 0, matchedFields: [] }, parsed)
    expect(boosted.score).toBe(0)
  })
})

describe('recallByKeywordWithParsedClue', () => {
  it('剥离时间词后靠内容词命中，且窗内条目压过窗外同内容', () => {
    const inRange = createTextExcerptMemoryItem({
      ownerId: OWNER,
      sourceLocalProfileId: PROFILE,
      now: () => '2026-07-27T09:00:00.000Z',
      payload: {
        selectedText: 'Li Bai poem',
        sourceUrl: 'https://poem.example/new',
        pageTitle: 'poem'
      }
    })
    const outOfRange = createTextExcerptMemoryItem({
      ownerId: OWNER,
      sourceLocalProfileId: PROFILE,
      now: () => '2026-06-01T09:00:00.000Z',
      payload: {
        selectedText: 'Li Bai poem',
        sourceUrl: 'https://poem.example/old',
        pageTitle: 'poem'
      }
    })

    const result = recallByKeywordWithParsedClue(
      [outOfRange, inRange],
      'yesterday saved a poem about Li Bai',
      { nowMs: NOW_MS }
    )

    expect(result.outcome).toBe('top_pick')
    expect(result.topPick?.item.id).toBe(inRange.id)
    expect(result.clue).toBe('yesterday saved a poem about Li Bai')
  })

  it('纯关键词线索行为不劣于旧 recallByKeyword（同 Top）', () => {
    const item = createBookmarkMemoryItem({
      ownerId: OWNER,
      sourceLocalProfileId: PROFILE,
      payload: {
        title: 'Cloudflare Workers Guide',
        url: 'https://developers.cloudflare.com/workers/'
      }
    })
    const clue = 'Cloudflare Workers'
    const orchestrated = recallByKeywordWithParsedClue([item], clue, { nowMs: NOW_MS })
    const baseline = recallByKeyword([item], clue, { nowMs: NOW_MS })
    expect(orchestrated.topPick?.item.id).toBe(baseline.topPick?.item.id)
    expect(orchestrated.outcome).toBe(baseline.outcome)
  })

  it('备注指向且条目有 note 时更易胜出', () => {
    const withNote = createBookmarkMemoryItem({
      ownerId: OWNER,
      sourceLocalProfileId: PROFILE,
      now: () => '2026-07-27T10:00:00.000Z',
      payload: { title: 'deploy guide', url: 'https://docs.example/deploy' },
      clues: { note: 'my note: deploy is great' }
    })
    const withoutNote = createBookmarkMemoryItem({
      ownerId: OWNER,
      sourceLocalProfileId: PROFILE,
      now: () => '2026-07-27T09:00:00.000Z',
      payload: { title: 'deploy mirror', url: 'https://mirror.example/deploy' }
    })

    const result = recallByKeywordWithParsedClue(
      [withoutNote, withNote],
      'yesterday my note about deploy',
      { nowMs: NOW_MS }
    )
    expect(result.topPick?.item.id).toBe(withNote.id)
  })

  it('对象类型 tags 可获得类型加成', () => {
    const parsed = parseRecallClue('article', { nowMs: NOW_MS })
    const item = createBookmarkMemoryItem({
      ownerId: OWNER,
      sourceLocalProfileId: PROFILE,
      payload: { title: 'some article', url: 'https://blog.example/a' },
      clues: { tags: ['article'] }
    })
    const boosted = applyParsedClueScoreBoosts(
      { item, score: 20, matchedFields: ['title'] },
      parsed
    )
    expect(boosted.score).toBe(20 + RECALL_ORCHESTRATION_OBJECT_TYPE_BOOST)
  })

  it('有 timeRange 时窗外同类不得成为 Top Pick（时间硬过滤）', () => {
    const outOfRange = createBookmarkMemoryItem({
      ownerId: OWNER,
      sourceLocalProfileId: PROFILE,
      now: () => '2026-06-01T09:00:00.000Z',
      payload: {
        title: 'Some youtube video',
        url: 'https://www.youtube.com/watch?v=REwnP79bbXo'
      },
      clues: { tags: ['video'] }
    })

    const yesterdayClue = 'The video I watched yesterday'
    expect(parseRecallClue(yesterdayClue, { nowMs: NOW_MS }).timeRange?.label).toBe('yesterday')
    const yesterday = recallByKeywordWithParsedClue([outOfRange], yesterdayClue, {
      nowMs: NOW_MS
    })
    expect(yesterday.outcome).toBe('no_match')
    expect(yesterday.topPick).toBeNull()

    const todayClue = 'The videos I watched today'
    expect(parseRecallClue(todayClue, { nowMs: NOW_MS }).timeRange?.label).toBe('today')
    const today = recallByKeywordWithParsedClue([outOfRange], todayClue, {
      nowMs: NOW_MS
    })
    expect(today.outcome).toBe('no_match')

    const noTime = recallByKeywordWithParsedClue([outOfRange], 'videos', { nowMs: NOW_MS })
    expect(parseRecallClue('videos', { nowMs: NOW_MS }).timeRange).toBeUndefined()
    expect(noTime.outcome).not.toBe('no_match')
    expect(noTime.topPick?.item.id ?? noTime.alsoPossible[0]?.item.id).toBe(outOfRange.id)
  })

  it('lastOpenedAt 落在时间窗内也算命中（watched）', () => {
    const item = createBookmarkMemoryItem({
      ownerId: OWNER,
      sourceLocalProfileId: PROFILE,
      now: () => '2026-06-01T09:00:00.000Z',
      payload: {
        title: 'Opened yesterday video',
        url: 'https://www.youtube.com/watch?v=opened'
      },
      clues: {
        tags: ['video'],
        lastOpenedAt: '2026-07-27T15:00:00.000Z'
      }
    })
    const result = recallByKeywordWithParsedClue([item], 'The video I watched yesterday', {
      nowMs: NOW_MS
    })
    expect(result.outcome).not.toBe('no_match')
    expect(result.topPick?.item.id ?? result.alsoPossible[0]?.item.id).toBe(item.id)
  })

  it('enrichment keeps wwii related video recallable', () => {
    const item = createBookmarkMemoryItem({
      ownerId: OWNER,
      sourceLocalProfileId: PROFILE,
      payload: {
        title: 'Why Hitler still casts a shadow after 80 years - BBC News',
        url: 'https://www.youtube.com/watch?v=hitler80'
      }
    })
    expect(item.clues.tags).toContain('video')
    expect(item.clues.keywords).toEqual(expect.arrayContaining(['wwii', 'video']))

    const english = recallByKeywordWithParsedClue([item], 'wwii related video', {
      nowMs: NOW_MS
    })
    expect(english.outcome).not.toBe('no_match')
    expect(english.topPick?.item.id ?? english.alsoPossible[0]?.item.id).toBe(item.id)
  })

  it('enrichment keeps city economy video recallable', () => {
    const item = createBookmarkMemoryItem({
      ownerId: OWNER,
      sourceLocalProfileId: PROFILE,
      payload: {
        title: 'Will Changchun become a bankrupt capital city as growth slows?',
        url: 'https://www.youtube.com/watch?v=_weXNUQ5NS4'
      }
    })
    const result = recallByKeywordWithParsedClue([item], 'changchun economy video', {
      nowMs: NOW_MS
    })
    expect(result.outcome).not.toBe('no_match')
    expect(result.topPick?.item.id ?? result.alsoPossible[0]?.item.id).toBe(item.id)
  })
})
