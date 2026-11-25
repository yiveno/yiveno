/**
 * A 层条件可信度：确定性算术全表单测（设计 §9 初值）。
 */
import { describe, expect, it } from 'vitest'

import {
  applyConditionBoosts,
  applyCredibilityEvent,
  applyUserConfirmToConditions,
  applyUserRefuteToConditions,
  clampCredibility,
  CONDITION_CREDIBILITY_CONSTANTS,
  conditionsForRanking,
  conditionsForUnderstandingEcho,
  credibilityState,
  credibilityWeight,
  hasCloseContradictionInSlot,
  initialCredibility,
  mergeConditionValues,
  relevanceForTurnsSinceMentioned,
  resolveConditionConflicts,
  type ScoredCondition
} from '@/core/recall/condition-credibility'

const NOW = Date.parse('2026-11-25T06:00:00.000Z')

function scored(
  partial: Partial<ScoredCondition> & Pick<ScoredCondition, 'slot' | 'value' | 'credibility'>
): ScoredCondition {
  return {
    source: 'statement',
    certainty: 'neutral',
    lastMentionedTurn: 0,
    effectiveAtMs: NOW,
    active: true,
    ...partial
  }
}

describe('initialCredibility', () => {
  it('四来源 × 适用确定度', () => {
    expect(initialCredibility('behavior')).toBe(0.8)
    expect(initialCredibility('behavior', 'hedge')).toBe(0.8)
    expect(initialCredibility('behavior', 'firm')).toBe(0.8)

    expect(initialCredibility('statement', 'hedge')).toBeCloseTo(0.4)
    expect(initialCredibility('statement', 'neutral')).toBe(0.5)
    expect(initialCredibility('statement', 'firm')).toBeCloseTo(0.65)

    expect(initialCredibility('inference')).toBe(0.4)
    expect(initialCredibility('inference', 'firm')).toBe(0.4)

    expect(initialCredibility('correction')).toBe(0.7)
    expect(initialCredibility('correction', 'hedge')).toBe(0.7)
  })
})

describe('applyCredibilityEvent', () => {
  it('六种事件增量', () => {
    expect(applyCredibilityEvent(0.5, 'sameTypeCorroboration')).toBeCloseTo(0.55)
    expect(applyCredibilityEvent(0.5, 'crossTypeCorroboration')).toBeCloseTo(0.65)
    expect(applyCredibilityEvent(0.5, 'contradiction')).toBeCloseTo(0.4)
    expect(applyCredibilityEvent(0.5, 'correction')).toBeCloseTo(0.3)
    expect(applyCredibilityEvent(0.5, 'siblingConfirm')).toBeCloseTo(0.55)
    expect(applyCredibilityEvent(0.5, 'siblingRefute')).toBeCloseTo(0.45)
  })

  it('上下限钳制 0.2 / 1.0', () => {
    expect(applyCredibilityEvent(0.22, 'contradiction')).toBe(0.2)
    expect(applyCredibilityEvent(0.95, 'crossTypeCorroboration')).toBe(1.0)
    expect(clampCredibility(0)).toBe(0.2)
    expect(clampCredibility(2)).toBe(1.0)
  })
})

describe('credibilityState', () => {
  it('状态边界', () => {
    expect(credibilityState(0.59, false)).toBe('unconfirmed')
    expect(credibilityState(0.6, false)).toBe('corroborated')
    expect(credibilityState(0.79, false)).toBe('corroborated')
    expect(credibilityState(0.8, false)).toBe('verified')
    expect(credibilityState(0.9, true)).toBe('contested')
  })

  it('有争议：分差 ≤0.15', () => {
    const rows = [
      scored({ slot: 'timeRange', value: 'yesterday', credibility: 0.5 }),
      scored({ slot: 'timeRange', value: 'last_week', credibility: 0.6 })
    ]
    expect(hasCloseContradictionInSlot(rows, 'timeRange')).toBe(true)
    expect(
      hasCloseContradictionInSlot(
        [
          scored({ slot: 'timeRange', value: 'yesterday', credibility: 0.4 }),
          scored({ slot: 'timeRange', value: 'last_week', credibility: 0.7 })
        ],
        'timeRange'
      )
    ).toBe(false)
  })
})

describe('mergeConditionValues / conflicts', () => {
  it('旧值 -0.10、新取先验、两者保留、按权重排序', () => {
    const merged = mergeConditionValues(
      'contentTerm',
      [
        {
          value: 'rag',
          credibility: 0.5,
          source: 'statement',
          certainty: 'neutral',
          lastMentionedTurn: 0,
          effectiveAtMs: NOW
        }
      ],
      [
        {
          value: 'poem',
          credibility: 0.65,
          source: 'statement',
          certainty: 'firm',
          lastMentionedTurn: 1,
          effectiveAtMs: NOW + 1
        }
      ],
      { currentTurn: 1 }
    )
    expect(merged).toHaveLength(2)
    const rag = merged.find(row => row.value === 'rag')
    const poem = merged.find(row => row.value === 'poem')
    expect(rag?.credibility).toBeCloseTo(0.4)
    expect(poem?.credibility).toBeCloseTo(0.65)
    expect(merged[0]?.value).toBe('poem')
  })

  it('同会话重复不计佐证，只刷新提及', () => {
    const merged = mergeConditionValues(
      'contentTerm',
      [
        {
          value: 'rag',
          credibility: 0.5,
          source: 'statement',
          certainty: 'neutral',
          lastMentionedTurn: 0,
          effectiveAtMs: NOW
        }
      ],
      [
        {
          value: 'rag',
          credibility: 0.5,
          source: 'statement',
          certainty: 'firm',
          lastMentionedTurn: 2,
          effectiveAtMs: NOW + 10
        }
      ],
      { currentTurn: 2 }
    )
    expect(merged).toHaveLength(1)
    expect(merged[0]?.credibility).toBe(0.5)
    expect(merged[0]?.lastMentionedTurn).toBe(2)
    expect(merged[0]?.certainty).toBe('firm')
  })

  it('互斥槽冲突：高分胜，平局后有效时间胜，败者失效不删除', () => {
    const resolved = resolveConditionConflicts([
      scored({
        slot: 'timeRange',
        value: 'yesterday',
        credibility: 0.5,
        effectiveAtMs: NOW
      }),
      scored({
        slot: 'timeRange',
        value: 'last_week',
        credibility: 0.5,
        effectiveAtMs: NOW + 5
      })
    ])
    const winner = resolved.find(row => row.active)
    const loser = resolved.find(row => !row.active)
    expect(winner?.value).toBe('last_week')
    expect(loser?.value).toBe('yesterday')
    expect(loser?.credibility).toBe(0.5)
  })
})

describe('sibling 耦合不跨状态边界', () => {
  it('+0.05 不跨过 0.6', () => {
    const next = applyCredibilityEvent(0.58, 'siblingConfirm')
    expect(next).toBeLessThan(0.6)
    expect(credibilityState(next, false)).toBe('unconfirmed')
  })

  it('-0.05 不跌破 0.6', () => {
    const next = applyCredibilityEvent(0.62, 'siblingRefute')
    expect(next).toBeGreaterThanOrEqual(0.6)
    expect(credibilityState(next, false)).toBe('corroborated')
  })

  it('+0.05 不跨过 0.8', () => {
    const next = applyCredibilityEvent(0.78, 'siblingConfirm')
    expect(next).toBeLessThan(0.8)
    expect(credibilityState(next, false)).toBe('corroborated')
  })
})

describe('relevanceForTurnsSinceMentioned', () => {
  it('1.0 → 3 轮后 0.5 → 6 轮后 0.25 → 下限 0.2', () => {
    expect(relevanceForTurnsSinceMentioned(0)).toBe(1)
    expect(relevanceForTurnsSinceMentioned(2)).toBe(1)
    expect(relevanceForTurnsSinceMentioned(3)).toBe(0.5)
    expect(relevanceForTurnsSinceMentioned(6)).toBe(0.25)
    expect(relevanceForTurnsSinceMentioned(9)).toBeCloseTo(0.2)
    expect(relevanceForTurnsSinceMentioned(100)).toBe(0.2)
  })
})

describe('applyConditionBoosts / 回显', () => {
  it('boost 排序；<0.3 不参排；无命中仍凭语义分；回显不按可信度过滤', () => {
    const conditions: ScoredCondition[] = [
      scored({ slot: 'contentTerm', value: 'rag', credibility: 0.8 }),
      scored({ slot: 'contentTerm', value: 'weak', credibility: 0.25 }),
      scored({
        slot: 'contentTerm',
        value: 'inactive',
        credibility: 0.9,
        active: false
      })
    ]

    const ranking = conditionsForRanking(conditions)
    expect(ranking.map(row => row.value)).toEqual(['rag'])

    const echo = conditionsForUnderstandingEcho(conditions)
    expect(echo).toHaveLength(3)

    type Cand = { id: string; score: number; hit: string }
    const candidates: Cand[] = [
      { id: 'a', score: 1.0, hit: 'rag' },
      { id: 'b', score: 1.05, hit: 'other' },
      { id: 'c', score: 0.9, hit: 'weak' }
    ]
    const boosted = applyConditionBoosts(
      candidates,
      conditions,
      (cand, condition) => cand.hit === condition.value,
      { currentTurn: 0 }
    )
    // a: 1.0 + 0.8*1.0 = 1.8；b: 1.05；c: 0.9（weak <0.3 不参排）
    expect(boosted.find(row => row.id === 'a')?.score).toBeCloseTo(1.8)
    expect(boosted.find(row => row.id === 'b')?.score).toBeCloseTo(1.05)
    expect(boosted.find(row => row.id === 'c')?.score).toBeCloseTo(0.9)

    const sorted = [...boosted].sort((left, right) => right.score - left.score)
    expect(sorted[0]?.id).toBe('a')
    // 无条件命中的 b 仍可凭语义分出现（未被过滤）
    expect(sorted.some(row => row.id === 'b')).toBe(true)
  })

  it('weight = credibility × relevance', () => {
    expect(credibilityWeight(0.8, 0.5)).toBeCloseTo(0.4)
    expect(CONDITION_CREDIBILITY_CONSTANTS.RANK_MIN_CREDIBILITY).toBe(0.3)
  })
})

describe('用户确认 / 否定接线纯函数', () => {
  it('确认：跨类 + 姊妹', () => {
    const next = applyUserConfirmToConditions(
      [
        scored({ slot: 'contentTerm', value: 'rag', credibility: 0.5 }),
        scored({ slot: 'objectType', value: 'article', credibility: 0.5 })
      ],
      new Set(['rag'])
    )
    expect(next.find(row => row.value === 'rag')?.credibility).toBeCloseTo(0.65)
    expect(next.find(row => row.value === 'article')?.credibility).toBeCloseTo(0.55)
  })

  it('否定：矛盾 + 姊妹', () => {
    const next = applyUserRefuteToConditions(
      [
        scored({ slot: 'contentTerm', value: 'rag', credibility: 0.5 }),
        scored({ slot: 'objectType', value: 'article', credibility: 0.5 })
      ],
      new Set(['rag'])
    )
    expect(next.find(row => row.value === 'rag')?.credibility).toBeCloseTo(0.4)
    expect(next.find(row => row.value === 'article')?.credibility).toBeCloseTo(0.45)
  })
})
