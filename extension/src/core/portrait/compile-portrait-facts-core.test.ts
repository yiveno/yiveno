/**
 * 画像夜间编译纯函数：行为 top3 / 交叉核查 / 重评。
 */

import { describe, expect, it } from 'vitest'

import { compilePortraitFactsCore } from '@/core/portrait/compile-portrait-facts-core'
import type { PortraitFactRecord } from '@/core/portrait/portrait-facts'
import type { BehaviorStatsRecord } from '@/infrastructure/indexeddb/behavior-stats-types'
import type { MemoryNoteRecord } from '@/infrastructure/indexeddb/memory-notes-types'

const OWNER = '11111111-1111-4111-8111-111111111111'
const NOW_MS = Date.UTC(2026, 10, 25)
const NOW_ISO = new Date(NOW_MS).toISOString()

function behavior(domain: string, visitCount: number, lastVisitTime: number): BehaviorStatsRecord {
  return {
    ownerId: OWNER,
    url: `https://${domain}/`,
    domain,
    visitCount,
    lastVisitTime,
    totalDwellMs: 0,
    updatedAt: NOW_ISO
  }
}

describe('compilePortraitFactsCore', () => {
  it('行为 favorite top3 → 行为事实进画像', () => {
    const result = compilePortraitFactsCore({
      ownerId: OWNER,
      existing: [],
      behaviorRows: [
        behavior('github.com', 20, NOW_MS),
        behavior('reddit.com', 10, NOW_MS - 86_400_000),
        behavior('example.com', 5, NOW_MS - 2 * 86_400_000)
      ],
      notes: [],
      nowMs: NOW_MS,
      nowIso: NOW_ISO
    })
    expect(result.stats.behaviorCandidates).toBe(3)
    const domains = result.upserts.map(r => r.value).sort()
    expect(domains).toEqual(['example.com', 'github.com', 'reddit.com'])
    expect(result.upserts.every(r => r.inPortrait)).toBe(true)
    expect(result.upserts.every(r => r.credibility >= 0.8)).toBe(true)
  })

  it('命题推断候选初始 0.4 不进画像', () => {
    const note = {
      id: `${OWNER}\u0000item\u00000`,
      ownerId: OWNER,
      sourceMemoryItemId: '22222222-2222-4222-8222-222222222222',
      sourceType: 'text_excerpt',
      text: 'User likes github.com a lot',
      sourceQuote: 'github.com',
      topicAnchor: ['rag'],
      dreamRunId: 'run',
      version: 1,
      schemaVersion: 1,
      sourceUpdatedAt: NOW_ISO,
      createdAt: NOW_ISO,
      updatedAt: NOW_ISO
    } satisfies MemoryNoteRecord
    const result = compilePortraitFactsCore({
      ownerId: OWNER,
      existing: [],
      behaviorRows: [],
      notes: [note],
      nowMs: NOW_MS,
      nowIso: NOW_ISO
    })
    expect(result.stats.inferenceCandidates).toBeGreaterThan(0)
    const inference = result.upserts.filter(r => r.sources.some(s => s.type === 'inference'))
    expect(inference.length).toBeGreaterThan(0)
    expect(inference.every(r => r.credibility === 0.4)).toBe(true)
    expect(inference.every(r => !r.inPortrait)).toBe(true)
  })

  it('陈述站点事实：90 天 top10 有访问 → 跨类 +0.15', () => {
    const existing: PortraitFactRecord = {
      id: `${OWNER}\0contentTerm\0github.com`,
      ownerId: OWNER,
      slot: 'contentTerm',
      value: 'github.com',
      credibility: 0.5,
      state: 'unconfirmed',
      sources: [{ type: 'statement', ref: 's', score: 0.5, observedAt: NOW_ISO }],
      inPortrait: false,
      createdAt: NOW_ISO,
      updatedAt: NOW_ISO
    }
    const result = compilePortraitFactsCore({
      ownerId: OWNER,
      existing: [existing],
      behaviorRows: [behavior('github.com', 8, NOW_MS)],
      notes: [],
      nowMs: NOW_MS,
      nowIso: NOW_ISO
    })
    const row = result.upserts.find(r => r.value === 'github.com')
    expect(row).toBeTruthy()
    // 行为 top3 也会写同一域名；交叉核查 + 行为合并后应 ≥0.65
    expect(row!.credibility).toBeGreaterThanOrEqual(0.65)
    expect(result.stats.crossBoosted).toBeGreaterThanOrEqual(1)
  })

  it('多条 contentTerm inference 同分 → 均 unconfirmed、无一 contested', () => {
    const note = (topic: string, idx: number): MemoryNoteRecord =>
      ({
        id: `${OWNER}\u0000note\u0000${idx}`,
        ownerId: OWNER,
        sourceMemoryItemId: '22222222-2222-4222-8222-222222222222',
        sourceType: 'text_excerpt',
        text: `User explores ${topic}`,
        sourceQuote: topic,
        topicAnchor: [topic],
        dreamRunId: 'run',
        version: 1,
        schemaVersion: 1,
        sourceUpdatedAt: NOW_ISO,
        createdAt: NOW_ISO,
        updatedAt: NOW_ISO
      }) satisfies MemoryNoteRecord
    const result = compilePortraitFactsCore({
      ownerId: OWNER,
      existing: [],
      behaviorRows: [],
      notes: [note('rag', 0), note('vector', 1), note('embeddings', 2)],
      nowMs: NOW_MS,
      nowIso: NOW_ISO
    })
    const inferences = result.upserts.filter(r => r.slot === 'contentTerm')
    expect(inferences.length).toBeGreaterThanOrEqual(3)
    expect(inferences.every(r => r.state === 'unconfirmed')).toBe(true)
    expect(inferences.every(r => r.state !== 'contested')).toBe(true)
  })

  it('互斥槽 timeRange 真冲突 → contested', () => {
    const existing: PortraitFactRecord[] = [
      {
        id: `${OWNER}\0timeRange\0last_week`,
        ownerId: OWNER,
        slot: 'timeRange',
        value: 'last_week',
        credibility: 0.7,
        state: 'corroborated',
        sources: [{ type: 'statement', ref: 's1', score: 0.7, observedAt: NOW_ISO }],
        inPortrait: true,
        createdAt: NOW_ISO,
        updatedAt: NOW_ISO
      },
      {
        id: `${OWNER}\0timeRange\0last_month`,
        ownerId: OWNER,
        slot: 'timeRange',
        value: 'last_month',
        credibility: 0.75,
        state: 'corroborated',
        sources: [{ type: 'statement', ref: 's2', score: 0.75, observedAt: NOW_ISO }],
        inPortrait: true,
        createdAt: NOW_ISO,
        updatedAt: NOW_ISO
      }
    ]
    const result = compilePortraitFactsCore({
      ownerId: OWNER,
      existing,
      behaviorRows: [],
      notes: [],
      nowMs: NOW_MS,
      nowIso: NOW_ISO
    })
    const timeRows = result.upserts.filter(r => r.slot === 'timeRange')
    expect(timeRows).toHaveLength(2)
    expect(timeRows.every(r => r.state === 'contested')).toBe(true)
  })

  it('功能词 topicAnchor 不生成 inference 行', () => {
    const note = {
      id: `${OWNER}\u0000item\u0000fn`,
      ownerId: OWNER,
      sourceMemoryItemId: '22222222-2222-4222-8222-222222222222',
      sourceType: 'text_excerpt',
      text: 'Footer links only',
      sourceQuote: 'contact',
      topicAnchor: ['联系', 'contact', 'subscribe', '周五发布'],
      dreamRunId: 'run',
      version: 1,
      schemaVersion: 1,
      sourceUpdatedAt: NOW_ISO,
      createdAt: NOW_ISO,
      updatedAt: NOW_ISO
    } satisfies MemoryNoteRecord
    const result = compilePortraitFactsCore({
      ownerId: OWNER,
      existing: [],
      behaviorRows: [],
      notes: [note],
      nowMs: NOW_MS,
      nowIso: NOW_ISO
    })
    expect(result.stats.inferenceCandidates).toBe(0)
    expect(result.upserts.filter(r => r.sources.some(s => s.type === 'inference'))).toHaveLength(0)
  })

  it('正常词 topicAnchor 仍生成 inference 行', () => {
    const note = {
      id: `${OWNER}\u0000item\u0000ok`,
      ownerId: OWNER,
      sourceMemoryItemId: '22222222-2222-4222-8222-222222222222',
      sourceType: 'text_excerpt',
      text: 'Notes about retrieval',
      sourceQuote: 'rag',
      topicAnchor: ['rag'],
      dreamRunId: 'run',
      version: 1,
      schemaVersion: 1,
      sourceUpdatedAt: NOW_ISO,
      createdAt: NOW_ISO,
      updatedAt: NOW_ISO
    } satisfies MemoryNoteRecord
    const result = compilePortraitFactsCore({
      ownerId: OWNER,
      existing: [],
      behaviorRows: [],
      notes: [note],
      nowMs: NOW_MS,
      nowIso: NOW_ISO
    })
    expect(result.stats.inferenceCandidates).toBe(1)
    expect(result.upserts.some(r => r.value === 'rag')).toBe(true)
  })
})
