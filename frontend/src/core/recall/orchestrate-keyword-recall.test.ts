import { describe, expect, it } from 'vitest'

import {
  RECALL_ORCHESTRATION_OBJECT_TYPE_BOOST,
  RECALL_ORCHESTRATION_TIME_BOOST,
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
})

describe('memoryItemInTimeRange / objectType', () => {
  it('按 createdAt 判断时间窗', () => {
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
  it('时间窗内条目获得时间加成', () => {
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
    // 同时命中 time + objectType
    expect(boosted.score).toBe(
      20 + RECALL_ORCHESTRATION_TIME_BOOST + RECALL_ORCHESTRATION_OBJECT_TYPE_BOOST
    )
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
      payload: { title: 'deploy guide', url: 'https://docs.example/deploy' },
      clues: { note: 'my note: deploy is great' }
    })
    const withoutNote = createBookmarkMemoryItem({
      ownerId: OWNER,
      sourceLocalProfileId: PROFILE,
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
})
