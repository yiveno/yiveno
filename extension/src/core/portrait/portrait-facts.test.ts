/**
 * B 层画像：编译门 / 晋升 / 批准忽略 / trait / 措辞。
 */

import { describe, expect, it } from 'vitest'

import {
  aggregateTraitScore,
  applyPortraitApprove,
  applyPortraitDecline,
  computePromoteInitialScore,
  portraitWordingKind,
  promoteConditionToPortraitFact,
  shouldEnterPortrait,
  type PortraitFactRecord
} from '@/core/portrait/portrait-facts'
import { buildPortraitSummary } from '@/core/portrait/build-portrait-summary'
import type { ScoredCondition } from '@/core/recall/condition-credibility'

const OWNER = '11111111-1111-4111-8111-111111111111'
const NOW = '2026-11-25T08:00:00.000Z'

function condition(overrides: Partial<ScoredCondition> = {}): ScoredCondition {
  return {
    slot: 'contentTerm',
    value: 'github.com',
    credibility: 0.55,
    source: 'statement',
    certainty: 'neutral',
    lastMentionedTurn: 0,
    effectiveAtMs: 1,
    active: true,
    ...overrides
  }
}

function fact(overrides: Partial<PortraitFactRecord> = {}): PortraitFactRecord {
  return {
    id: `${OWNER}\0contentTerm\0github.com`,
    ownerId: OWNER,
    slot: 'contentTerm',
    value: 'github.com',
    credibility: 0.5,
    state: 'unconfirmed',
    sources: [
      {
        type: 'statement',
        ref: 's1',
        score: 0.5,
        observedAt: NOW
      }
    ],
    inPortrait: false,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides
  }
}

describe('portrait-facts · 编译门', () => {
  it('行为 1 源 + ≥0.6 → 进画像', () => {
    expect(
      shouldEnterPortrait({
        credibility: 0.8,
        state: 'verified',
        sources: [{ type: 'behavior', ref: 'b', score: 0.8, observedAt: NOW }]
      })
    ).toBe(true)
  })

  it('陈述单源不进', () => {
    expect(
      shouldEnterPortrait({
        credibility: 0.7,
        state: 'corroborated',
        sources: [{ type: 'statement', ref: 's', score: 0.7, observedAt: NOW }]
      })
    ).toBe(false)
  })

  it('陈述+推断两源类型 + ≥0.6 → 进', () => {
    expect(
      shouldEnterPortrait({
        credibility: 0.65,
        state: 'corroborated',
        sources: [
          { type: 'statement', ref: 's', score: 0.5, observedAt: NOW },
          { type: 'inference', ref: 'i', score: 0.4, observedAt: NOW }
        ]
      })
    ).toBe(true)
  })

  it('<0.6 不进', () => {
    expect(
      shouldEnterPortrait({
        credibility: 0.55,
        state: 'unconfirmed',
        sources: [
          { type: 'statement', ref: 's', score: 0.5, observedAt: NOW },
          { type: 'inference', ref: 'i', score: 0.4, observedAt: NOW }
        ]
      })
    ).toBe(false)
  })
})

describe('portrait-facts · 晋升', () => {
  it('初始分 max(0.6, 确认后分+0.1)', () => {
    expect(computePromoteInitialScore(0.55)).toBeCloseTo(0.65, 5)
    expect(computePromoteInitialScore(0.4)).toBe(0.6)
  })

  it('无同行 → 新行且进画像（陈述+确认行为）', () => {
    const next = promoteConditionToPortraitFact({
      existing: null,
      ownerId: OWNER,
      condition: condition({ credibility: 0.55 }),
      nowIso: NOW,
      sourceRef: 'turn:0'
    })
    expect(next.credibility).toBeCloseTo(0.65, 5)
    expect(next.sources).toHaveLength(2)
    expect(next.inPortrait).toBe(true)
    expect(next.id).toContain('github.com')
  })

  it('已有同行 → 追加来源不另起行 + 跨类佐证', () => {
    const existing = fact({ credibility: 0.6, state: 'corroborated' })
    const next = promoteConditionToPortraitFact({
      existing,
      ownerId: OWNER,
      condition: condition({ credibility: 0.7 }),
      nowIso: NOW,
      sourceRef: 'turn:1'
    })
    expect(next.id).toBe(existing.id)
    expect(next.credibility).toBeCloseTo(0.75, 5)
    expect(next.sources.length).toBe(existing.sources.length + 1)
  })
})

describe('portrait-facts · 批准/忽略', () => {
  it('批准 → 0.8 verified inPortrait', () => {
    const next = applyPortraitApprove(fact({ credibility: 0.4 }), NOW)
    expect(next.credibility).toBe(0.8)
    expect(next.state).toBe('verified')
    expect(next.inPortrait).toBe(true)
  })

  it('忽略 → invalid 0.2 出画像 行保留', () => {
    const prior = fact({ inPortrait: true, credibility: 0.7, state: 'corroborated' })
    const next = applyPortraitDecline(prior, NOW)
    expect(next.state).toBe('invalid')
    expect(next.credibility).toBe(0.2)
    expect(next.inPortrait).toBe(false)
    expect(next.id).toBe(prior.id)
  })
})

describe('portrait-facts · trait / 措辞 / 摘要', () => {
  it('trait = max + 0.05×独立源类型', () => {
    const rows = [
      fact({
        credibility: 0.7,
        sources: [
          { type: 'statement', ref: 'a', score: 0.7, observedAt: NOW },
          { type: 'behavior', ref: 'b', score: 0.8, observedAt: NOW }
        ]
      })
    ]
    expect(aggregateTraitScore(rows)).toBeCloseTo(0.8, 5)
  })

  it('四态措辞', () => {
    expect(portraitWordingKind(0.4, 'unconfirmed', ['inference'])).toBe('inferred')
    expect(portraitWordingKind(0.5, 'unconfirmed', ['statement'])).toBe('paraphrase')
    expect(portraitWordingKind(0.7, 'corroborated', ['behavior'])).toBe('hedged')
    expect(portraitWordingKind(0.85, 'verified', ['statement', 'behavior'])).toBe('direct')
    expect(portraitWordingKind(0.7, 'contested', ['statement'])).toBe('juxtapose')
  })

  it('摘要分组 + 空态 + pending 推断门槛', () => {
    expect(buildPortraitSummary([]).empty).toBe(true)
    const summary = buildPortraitSummary([
      fact({
        credibility: 0.85,
        state: 'verified',
        inPortrait: true,
        sources: [
          { type: 'statement', ref: 'a', score: 0.5, observedAt: NOW },
          { type: 'behavior', ref: 'b', score: 0.8, observedAt: NOW }
        ]
      }),
      fact({
        id: `${OWNER}\0contentTerm\0rag`,
        value: 'rag',
        credibility: 0.4,
        state: 'unconfirmed',
        inPortrait: false,
        sources: [{ type: 'inference', ref: 'note:1', score: 0.4, observedAt: NOW }]
      }),
      fact({
        id: `${OWNER}\0contentTerm\0zig`,
        value: 'zig',
        credibility: 0.4,
        state: 'unconfirmed',
        inPortrait: false,
        sources: [
          { type: 'inference', ref: 'note:1', score: 0.4, observedAt: NOW },
          { type: 'inference', ref: 'note:2', score: 0.4, observedAt: NOW }
        ]
      })
    ])
    expect(summary.empty).toBe(false)
    expect(summary.groups.verified).toHaveLength(1)
    // rag 与 zig 共享 note:1 → 共现成一簇（≥2）浮出
    expect(summary.groups.unconfirmed).toHaveLength(2)
    expect(summary.clusters.filter(c => c.surfaced)).toHaveLength(1)
    expect(summary.hiddenPendingCount).toBe(0)
  })
})
