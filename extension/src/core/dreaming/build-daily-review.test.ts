import { describe, expect, it } from 'vitest'

import {
  buildDailyReview,
  DAILY_REVIEW_GROUP_NOTE_LIMIT,
  getLocalYesterdayWindow,
  partitionNotesByLocalDay
} from '@/core/dreaming/build-daily-review'
import { DREAMING_SCHEMA_VERSION } from '@/core/dreaming/dreaming-constants'
import {
  buildMemoryNoteId,
  type MemoryNoteRecord
} from '@/infrastructure/indexeddb/memory-notes-types'

const OWNER = '11111111-1111-4111-8111-111111111111'
const SOURCE_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const SOURCE_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const SOURCE_C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

function localIso(daysAgo: number, hour = 12): string {
  const now = new Date()
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo, hour, 0, 0, 0)
  return d.toISOString()
}

function makeNote(input: {
  sourceId: string
  index: number
  text: string
  createdAt: string
  topicAnchor?: string[]
  sourceQuote?: string
  sourceSpan?: { start: number; end: number }
}): MemoryNoteRecord {
  return {
    id: buildMemoryNoteId(OWNER, input.sourceId, input.index),
    ownerId: OWNER,
    sourceMemoryItemId: input.sourceId,
    sourceType: 'text_excerpt',
    text: input.text,
    sourceQuote: input.sourceQuote ?? 'quoted passage',
    ...(input.sourceSpan ? { sourceSpan: input.sourceSpan } : {}),
    topicAnchor: input.topicAnchor ?? [],
    dreamRunId: 'dream-run-1',
    version: 1,
    schemaVersion: DREAMING_SCHEMA_VERSION,
    sourceUpdatedAt: input.createdAt,
    createdAt: input.createdAt,
    updatedAt: input.createdAt
  }
}

describe('getLocalYesterdayWindow / partitionNotesByLocalDay', () => {
  it('昨日窗口为本地日历昨日 00:00（含）至今日 00:00（不含）', () => {
    const { startMs, endMs } = getLocalYesterdayWindow()
    const start = new Date(startMs)
    const end = new Date(endMs)
    expect(start.getHours()).toBe(0)
    expect(start.getMinutes()).toBe(0)
    expect(end.getHours()).toBe(0)
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000)
  })

  it('按 createdAt 分昨日 / 更早 / 最近 7 天', () => {
    const yesterday = makeNote({
      sourceId: SOURCE_A,
      index: 0,
      text: 'y',
      createdAt: localIso(1)
    })
    const older = makeNote({
      sourceId: SOURCE_A,
      index: 1,
      text: 'o',
      createdAt: localIso(10)
    })
    const today = makeNote({
      sourceId: SOURCE_A,
      index: 2,
      text: 't',
      createdAt: localIso(0)
    })
    const parted = partitionNotesByLocalDay([yesterday, older, today])
    expect(parted.yesterdayNotes.map(n => n.id)).toEqual([yesterday.id])
    expect(parted.olderNotes.map(n => n.id)).toEqual([older.id])
    expect(parted.recentNotes.map(n => n.id).sort()).toEqual([yesterday.id, today.id].sort())
  })
})

describe('buildDailyReview · 分组', () => {
  it('共享 topic 词成组；无关系不成组；单成员组无关系句', () => {
    const a = makeNote({
      sourceId: SOURCE_A,
      index: 0,
      text: 'note a',
      createdAt: localIso(1, 10),
      topicAnchor: ['rust']
    })
    const b = makeNote({
      sourceId: SOURCE_B,
      index: 0,
      text: 'note b',
      createdAt: localIso(1, 11),
      topicAnchor: ['rust', 'async']
    })
    const c = makeNote({
      sourceId: SOURCE_C,
      index: 0,
      text: 'note c',
      createdAt: localIso(1, 12),
      topicAnchor: ['gardening']
    })
    const result = buildDailyReview({
      yesterdayNotes: [a, b, c],
      olderNotes: [],
      recentNotes: [a, b, c],
      staleSourceIds: new Set(),
      staleFirstSeenAt: new Map(),
      sourceTitles: new Map([
        [SOURCE_A, 'A'],
        [SOURCE_B, 'B'],
        [SOURCE_C, 'C']
      ])
    })
    expect(result.groups).toHaveLength(2)
    expect(result.groups[0]!.notes.map(n => n.id)).toEqual([a.id, b.id])
    expect(result.groups[0]!.relation).toEqual({
      kind: 'shared_topic',
      memberCount: 2,
      term: 'rust'
    })
    expect(result.groups[1]!.notes.map(n => n.id)).toEqual([c.id])
    expect(result.groups[1]!.relation).toBeNull()
  })

  it('同源成组；关系句同源优先于共享词', () => {
    const a = makeNote({
      sourceId: SOURCE_A,
      index: 0,
      text: 'one',
      createdAt: localIso(1, 9),
      topicAnchor: ['shared']
    })
    const b = makeNote({
      sourceId: SOURCE_A,
      index: 1,
      text: 'two',
      createdAt: localIso(1, 10),
      topicAnchor: ['shared', 'other']
    })
    const result = buildDailyReview({
      yesterdayNotes: [a, b],
      olderNotes: [],
      recentNotes: [a, b],
      staleSourceIds: new Set(),
      staleFirstSeenAt: new Map(),
      sourceTitles: new Map([[SOURCE_A, 'Same Save']])
    })
    expect(result.groups).toHaveLength(1)
    expect(result.groups[0]!.relation).toEqual({
      kind: 'same_source',
      title: 'Same Save'
    })
  })

  it('同源但标题取不到 → title null', () => {
    const a = makeNote({
      sourceId: SOURCE_A,
      index: 0,
      text: 'one',
      createdAt: localIso(1, 9)
    })
    const b = makeNote({
      sourceId: SOURCE_A,
      index: 1,
      text: 'two',
      createdAt: localIso(1, 10)
    })
    const result = buildDailyReview({
      yesterdayNotes: [a, b],
      olderNotes: [],
      recentNotes: [a, b],
      staleSourceIds: new Set(),
      staleFirstSeenAt: new Map(),
      sourceTitles: new Map()
    })
    expect(result.groups[0]!.relation).toEqual({ kind: 'same_source', title: null })
    expect(result.groups[0]!.notes[0]!.sourceExists).toBe(false)
  })
})

describe('buildDailyReview · 值得再看', () => {
  it('共享词计分；并列取 createdAt 最晚；理由含 older 命中数最多的词', () => {
    const yEarly = makeNote({
      sourceId: SOURCE_A,
      index: 0,
      text: 'early',
      createdAt: localIso(1, 8),
      topicAnchor: ['alpha']
    })
    const yLate = makeNote({
      sourceId: SOURCE_B,
      index: 0,
      text: 'late',
      createdAt: localIso(1, 18),
      topicAnchor: ['alpha']
    })
    const older1 = makeNote({
      sourceId: SOURCE_C,
      index: 0,
      text: 'old1',
      createdAt: localIso(20),
      topicAnchor: ['alpha']
    })
    const older2 = makeNote({
      sourceId: SOURCE_C,
      index: 1,
      text: 'old2',
      createdAt: localIso(19),
      topicAnchor: ['alpha', 'beta']
    })
    const result = buildDailyReview({
      yesterdayNotes: [yEarly, yLate],
      olderNotes: [older1, older2],
      recentNotes: [yEarly, yLate],
      staleSourceIds: new Set(),
      staleFirstSeenAt: new Map(),
      sourceTitles: new Map([
        [SOURCE_A, 'A'],
        [SOURCE_B, 'B'],
        [SOURCE_C, 'C']
      ])
    })
    expect(result.featured?.note.id).toBe(yLate.id)
    expect(result.featured?.reason).toEqual({
      kind: 'shared_with_older',
      term: 'alpha',
      olderHitCount: 2
    })
  })

  it('全 0 分走 recent topic fallback', () => {
    const y = makeNote({
      sourceId: SOURCE_A,
      index: 0,
      text: 'y',
      createdAt: localIso(1),
      topicAnchor: ['weekly']
    })
    const recentOther = makeNote({
      sourceId: SOURCE_B,
      index: 0,
      text: 'r',
      createdAt: localIso(2),
      topicAnchor: ['weekly']
    })
    const olderUnrelated = makeNote({
      sourceId: SOURCE_C,
      index: 0,
      text: 'o',
      createdAt: localIso(30),
      topicAnchor: ['ancient']
    })
    const result = buildDailyReview({
      yesterdayNotes: [y],
      olderNotes: [olderUnrelated],
      recentNotes: [y, recentOther],
      staleSourceIds: new Set(),
      staleFirstSeenAt: new Map(),
      sourceTitles: new Map([
        [SOURCE_A, 'A'],
        [SOURCE_B, 'B'],
        [SOURCE_C, 'C']
      ])
    })
    expect(result.featured?.reason).toEqual({ kind: 'recent_topic', term: 'weekly' })
  })

  it('仍全 0 → 昨日最晚 + latest_yesterday', () => {
    const early = makeNote({
      sourceId: SOURCE_A,
      index: 0,
      text: 'e',
      createdAt: localIso(1, 9),
      topicAnchor: []
    })
    const late = makeNote({
      sourceId: SOURCE_B,
      index: 0,
      text: 'l',
      createdAt: localIso(1, 20),
      topicAnchor: []
    })
    const result = buildDailyReview({
      yesterdayNotes: [early, late],
      olderNotes: [],
      recentNotes: [early, late],
      staleSourceIds: new Set(),
      staleFirstSeenAt: new Map(),
      sourceTitles: new Map([
        [SOURCE_A, 'A'],
        [SOURCE_B, 'B']
      ])
    })
    expect(result.featured?.note.id).toBe(late.id)
    expect(result.featured?.reason).toEqual({ kind: 'latest_yesterday' })
  })
})

describe('buildDailyReview · 过时', () => {
  it('只认 stale；不认 unknown；最多一件；取最早 firstStaleAt', () => {
    const noteStaleEarly = makeNote({
      sourceId: SOURCE_A,
      index: 0,
      text: 'stale early',
      createdAt: localIso(5)
    })
    const noteStaleLate = makeNote({
      sourceId: SOURCE_B,
      index: 0,
      text: 'stale late',
      createdAt: localIso(4)
    })
    const noteOk = makeNote({
      sourceId: SOURCE_C,
      index: 0,
      text: 'ok',
      createdAt: localIso(1)
    })
    const result = buildDailyReview({
      yesterdayNotes: [noteOk],
      olderNotes: [noteStaleEarly, noteStaleLate],
      recentNotes: [noteOk],
      staleSourceIds: new Set([SOURCE_A, SOURCE_B]),
      staleFirstSeenAt: new Map([
        [SOURCE_A, '2026-11-01T00:00:00.000Z'],
        [SOURCE_B, '2026-11-10T00:00:00.000Z']
      ]),
      sourceTitles: new Map([
        [SOURCE_A, 'A'],
        [SOURCE_B, 'B'],
        [SOURCE_C, 'C']
      ])
    })
    expect(result.stale?.sourceMemoryItemId).toBe(SOURCE_A)
    expect(result.stale?.firstStaleAt).toBe('2026-11-01T00:00:00.000Z')
    expect(result.stale?.note.id).toBe(noteStaleEarly.id)
  })

  it('无 stale 来源 → stale null', () => {
    const y = makeNote({
      sourceId: SOURCE_A,
      index: 0,
      text: 'y',
      createdAt: localIso(1)
    })
    const result = buildDailyReview({
      yesterdayNotes: [y],
      olderNotes: [],
      recentNotes: [y],
      staleSourceIds: new Set(),
      staleFirstSeenAt: new Map(),
      sourceTitles: new Map([[SOURCE_A, 'A']])
    })
    expect(result.stale).toBeNull()
  })
})

describe('buildDailyReview · 空输入 / 脏行 / 截断', () => {
  it('昨日 0 条 → groups 空、featured null', () => {
    const result = buildDailyReview({
      yesterdayNotes: [],
      olderNotes: [],
      recentNotes: [],
      staleSourceIds: new Set(),
      staleFirstSeenAt: new Map(),
      sourceTitles: new Map()
    })
    expect(result.groups).toEqual([])
    expect(result.featured).toBeNull()
    expect(result.yesterdayNoteCount).toBe(0)
    expect(result.skippedDirtyNotes).toBe(0)
  })

  it('脏行（quote 空且无合法 span）计数且不渲染', () => {
    const dirty = makeNote({
      sourceId: SOURCE_A,
      index: 0,
      text: 'dirty',
      createdAt: localIso(1),
      sourceQuote: '   '
    })
    // 无 sourceSpan → 脏
    const clean = makeNote({
      sourceId: SOURCE_B,
      index: 0,
      text: 'clean',
      createdAt: localIso(1, 13),
      sourceQuote: '',
      sourceSpan: { start: 0, end: 4 }
    })
    const result = buildDailyReview({
      yesterdayNotes: [dirty, clean],
      olderNotes: [],
      recentNotes: [dirty, clean],
      staleSourceIds: new Set(),
      staleFirstSeenAt: new Map(),
      sourceTitles: new Map([
        [SOURCE_A, 'A'],
        [SOURCE_B, 'B']
      ])
    })
    expect(result.skippedDirtyNotes).toBe(1)
    expect(result.yesterdayNoteCount).toBe(1)
    expect(result.groups[0]!.notes.map(n => n.id)).toEqual([clean.id])
  })

  it(`超过 ${DAILY_REVIEW_GROUP_NOTE_LIMIT} 条时截断并标记 groupsTruncated`, () => {
    const notes = Array.from({ length: 22 }, (_, i) =>
      makeNote({
        sourceId: SOURCE_A,
        index: i,
        text: `n${i}`,
        createdAt: localIso(1, 1 + (i % 20)),
        topicAnchor: [`unique-${i}`]
      })
    )
    // 强制不同 createdAt 排序稳定：用固定偏移
    const stamped = notes.map((n, i) => ({
      ...n,
      createdAt: new Date(Date.parse(localIso(1, 0)) + i * 60_000).toISOString()
    }))
    const result = buildDailyReview({
      yesterdayNotes: stamped,
      olderNotes: [],
      recentNotes: stamped,
      staleSourceIds: new Set(),
      staleFirstSeenAt: new Map(),
      sourceTitles: new Map([[SOURCE_A, 'A']])
    })
    expect(result.yesterdayNoteCount).toBe(22)
    expect(result.groupsTruncated).toBe(true)
    expect(result.groups.reduce((sum, g) => sum + g.notes.length, 0)).toBe(
      DAILY_REVIEW_GROUP_NOTE_LIMIT
    )
  })
})
