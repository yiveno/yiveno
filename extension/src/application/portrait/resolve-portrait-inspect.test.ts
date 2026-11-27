/**
 * 画像可查性路由：空态 / 分组摘要。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

const listByOwnerMock = vi.hoisted(() => vi.fn())
const getCurrentOwnerIdMock = vi.hoisted(() =>
  vi.fn(async () => '11111111-1111-4111-8111-111111111111')
)

vi.mock('@/infrastructure/identity/local-profile-service', () => ({
  getCurrentOwnerId: getCurrentOwnerIdMock
}))

vi.mock('@/infrastructure/indexeddb/portrait-facts-repository', () => ({
  portraitFactsRepository: {
    listByOwner: listByOwnerMock
  }
}))

vi.mock('@/infrastructure/logging/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

import { resolvePortraitInspect } from '@/application/portrait/resolve-portrait-inspect'
import type { PortraitFactRecord } from '@/core/portrait/portrait-facts'
import type { ParsedRecallClue } from '@/core/recall/parse-recall-clue-types'

const OWNER = '11111111-1111-4111-8111-111111111111'
const NOW = '2026-11-25T08:00:00.000Z'

const baseParsed: ParsedRecallClue = {
  raw: 'what do you know about me',
  contentTerms: [],
  confidence: 'low',
  portraitQuery: true
}

describe('resolvePortraitInspect', () => {
  beforeEach(() => {
    listByOwnerMock.mockReset()
    getCurrentOwnerIdMock.mockClear()
  })

  it('无事实 → emptyKind=portrait_inspect + empty 摘要', async () => {
    listByOwnerMock.mockResolvedValue([])
    const result = await resolvePortraitInspect({
      clue: '你了解我多少',
      parsed: baseParsed
    })
    expect(result.emptyKind).toBe('portrait_inspect')
    expect(result.outcome).toBe('no_match')
    expect(result.portraitSummary?.empty).toBe(true)
  })

  it('按状态分组；推断未进画像进 pending', async () => {
    const facts: PortraitFactRecord[] = [
      {
        id: `${OWNER}\0contentTerm\0github.com`,
        ownerId: OWNER,
        slot: 'contentTerm',
        value: 'github.com',
        credibility: 0.85,
        state: 'verified',
        sources: [
          { type: 'statement', ref: 'a', score: 0.5, observedAt: NOW },
          { type: 'behavior', ref: 'b', score: 0.8, observedAt: NOW }
        ],
        inPortrait: true,
        createdAt: NOW,
        updatedAt: NOW
      },
      {
        id: `${OWNER}\0contentTerm\0rag`,
        ownerId: OWNER,
        slot: 'contentTerm',
        value: 'rag',
        credibility: 0.4,
        state: 'unconfirmed',
        sources: [{ type: 'inference', ref: 'note:1', score: 0.4, observedAt: NOW }],
        inPortrait: false,
        createdAt: NOW,
        updatedAt: NOW
      }
    ]
    listByOwnerMock.mockResolvedValue(facts)
    const result = await resolvePortraitInspect({
      clue: 'what do you know about me',
      parsed: baseParsed
    })
    expect(result.portraitSummary?.empty).toBe(false)
    expect(result.portraitSummary?.groups.verified).toHaveLength(1)
    // 单来源 credibility 0.4 → 未达展示门槛，计入 hidden
    expect(result.portraitSummary?.clusters).toHaveLength(0)
    expect(result.portraitSummary?.hiddenPendingCount).toBe(1)
  })
})
