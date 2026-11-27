/**
 * 路由策略纯函数：排序字典序、预留线分档、隐私门、快照缺失。
 */

import { describe, expect, test } from 'bun:test'
import { AI_CHAT_TASK_KINDS } from '../../config/ai-task-kind'
import type { AiCandidateEntry } from './ai-candidate-registry'
import {
  blendedPricePer1M,
  isPrivacyRoutable,
  rankCandidates,
  reserveFloorForTask
} from './ai-routing-policy'
import type { QuotaSnapshot } from './quota-ledger-state'

describe('reserveFloorForTask', () => {
  test('interactive 恒 0', () => {
    for (const kind of AI_CHAT_TASK_KINDS) {
      expect(reserveFloorForTask(kind, 'interactive')).toBe(0)
    }
  })

  test('background 分档：dreaming/extract=0.35；enrichment/gs_samples/其余=0.2', () => {
    expect(reserveFloorForTask('dreaming', 'background')).toBe(0.35)
    expect(reserveFloorForTask('extract', 'background')).toBe(0.35)
    expect(reserveFloorForTask('enrichment', 'background')).toBe(0.2)
    expect(reserveFloorForTask('gs_samples', 'background')).toBe(0.2)
    expect(reserveFloorForTask('nlu', 'background')).toBe(0.2)
    expect(reserveFloorForTask('framing_nlg', 'background')).toBe(0.2)
  })
})

describe('isPrivacyRoutable / blendedPricePer1M', () => {
  test('free_terms_unverified 不可路由；其余可', () => {
    expect(isPrivacyRoutable(freeCandidate('u', { privacyTier: 'free_terms_unverified' }))).toBe(
      false
    )
    expect(isPrivacyRoutable(freeCandidate('ok', { privacyTier: 'free_terms_ok' }))).toBe(true)
    expect(isPrivacyRoutable(paidCandidate('p'))).toBe(true)
  })

  test('blended = input×3 + output；无价格 → undefined', () => {
    expect(blendedPricePer1M(paidCandidate('a'))).toBeUndefined()
    expect(
      blendedPricePer1M(paidCandidate('b', { paidPricePer1M: { input: 0.1, output: 0.4 } }))
    ).toBeCloseTo(0.1 * 3 + 0.4)
    expect(blendedPricePer1M(paidCandidate('c', { paidPricePer1M: { input: 0.2 } }))).toBeCloseTo(
      0.6
    )
    expect(blendedPricePer1M(paidCandidate('d', { paidPricePer1M: {} }))).toBeUndefined()
  })
})

describe('rankCandidates', () => {
  test('免费优先于付费', () => {
    const paid = paidCandidate('paid')
    const free = freeCandidate('free')
    const ranked = rankCandidates([paid, free], {})
    expect(ranked.map(c => c.candidateId)).toEqual(['free', 'paid'])
  })

  test('日窗剩余比例高者优先', () => {
    const low = freeCandidate('low')
    const high = freeCandidate('high')
    const ranked = rankCandidates([low, high], {
      low: snap('low', { dailyRemainingRatio: 0.2, minuteRemainingRatio: 1 }),
      high: snap('high', { dailyRemainingRatio: 0.9, minuteRemainingRatio: 1 })
    })
    expect(ranked.map(c => c.candidateId)).toEqual(['high', 'low'])
  })

  test('日窗相同时分钟剩余比例高者优先', () => {
    const lowMin = freeCandidate('low-min')
    const highMin = freeCandidate('high-min')
    const ranked = rankCandidates([lowMin, highMin], {
      'low-min': snap('low-min', { dailyRemainingRatio: 0.5, minuteRemainingRatio: 0.1 }),
      'high-min': snap('high-min', { dailyRemainingRatio: 0.5, minuteRemainingRatio: 0.8 })
    })
    expect(ranked.map(c => c.candidateId)).toEqual(['high-min', 'low-min'])
  })

  test('付费按 blended 单价低者优先', () => {
    const expensive = paidCandidate('exp', {
      paidPricePer1M: { input: 1, output: 2 }
    })
    const cheap = paidCandidate('cheap', {
      paidPricePer1M: { input: 0.1, output: 0.2 }
    })
    const ranked = rankCandidates([expensive, cheap], {
      exp: snap('exp'),
      cheap: snap('cheap')
    })
    expect(ranked.map(c => c.candidateId)).toEqual(['cheap', 'exp'])
  })

  test('无价格排在有价格之后', () => {
    const priced = paidCandidate('priced', {
      paidPricePer1M: { input: 1, output: 1 }
    })
    const unpriced = paidCandidate('unpriced')
    const ranked = rankCandidates([unpriced, priced], {
      priced: snap('priced'),
      unpriced: snap('unpriced')
    })
    expect(ranked.map(c => c.candidateId)).toEqual(['priced', 'unpriced'])
  })

  test('同分保持注册表顺序（稳定序）', () => {
    const a = paidCandidate('a', { paidPricePer1M: { input: 1, output: 1 } })
    const b = paidCandidate('b', { paidPricePer1M: { input: 1, output: 1 } })
    const ranked = rankCandidates([a, b], {
      a: snap('a'),
      b: snap('b')
    })
    expect(ranked.map(c => c.candidateId)).toEqual(['a', 'b'])
  })

  test('快照缺失按剩余比例 1 但排在有快照者之后', () => {
    const withSnap = freeCandidate('with')
    const missing = freeCandidate('missing')
    // missing 视为 ratio=1，with 仅 0.4；仍因「有快照优先」排 with 在前
    const ranked = rankCandidates([missing, withSnap], {
      with: snap('with', { dailyRemainingRatio: 0.4, minuteRemainingRatio: 0.4 })
    })
    expect(ranked.map(c => c.candidateId)).toEqual(['with', 'missing'])
  })

  test('同缺快照时按注册表稳定序', () => {
    const a = freeCandidate('a')
    const b = freeCandidate('b')
    expect(rankCandidates([a, b], {}).map(c => c.candidateId)).toEqual(['a', 'b'])
  })
})

function snap(
  candidateId: string,
  ratios: { dailyRemainingRatio?: number; minuteRemainingRatio?: number } = {}
): QuotaSnapshot {
  return {
    candidateId,
    minuteWindow: { requestCount: 0, tokenEstimate: 0, windowStartMs: 0 },
    dayWindow: { requestCount: 0, tokenEstimate: 0, resetAtMs: 1 },
    pendingCount: 0,
    ...ratios
  }
}

function paidCandidate(id: string, overrides: Partial<AiCandidateEntry> = {}): AiCandidateEntry {
  return {
    candidateId: id,
    providerId: 'deepseek',
    model: `${id}-model`,
    apiKeyEnv: 'DEEPSEEK_API_KEY',
    privacyTier: 'paid_standard',
    qualifiedTaskKinds: [...AI_CHAT_TASK_KINDS],
    evalNote: 'test',
    enabled: true,
    ...overrides
  }
}

function freeCandidate(id: string, overrides: Partial<AiCandidateEntry> = {}): AiCandidateEntry {
  return {
    candidateId: id,
    providerId: 'gateway-compat',
    compatVendor: 'groq',
    model: `${id}-model`,
    apiKeyEnv: 'GROQ_API_KEY',
    freeTier: { rpm: 30, rpd: 100 },
    privacyTier: 'free_terms_ok',
    qualifiedTaskKinds: [...AI_CHAT_TASK_KINDS],
    evalNote: 'test',
    enabled: true,
    ...overrides
  }
}
