/**
 * 额度账本纯函数：分钟窗滚动、日重置、冷却、预留后对账校准。
 */

import { describe, expect, test } from 'bun:test'
import {
  computeDailyRemainingRatio,
  computeNextDayResetMs,
  createEmptyQuotaLedgerState,
  DEFAULT_MINUTE_COOLDOWN_MS,
  LONG_COOLDOWN_MS,
  reconcileQuota,
  reserveQuota,
  snapshotQuota
} from './quota-ledger-state'

const FREE = { rpm: 2, tpm: 100, rpd: 5, tpd: 500, resetHourUtc: 0 }

describe('computeNextDayResetMs', () => {
  test('未过今日重置点 → 今日该 UTC 整点', () => {
    const now = Date.UTC(2026, 10, 27, 3, 0, 0) // 03:00 UTC
    expect(computeNextDayResetMs(now, { resetHourUtc: 8 })).toBe(Date.UTC(2026, 10, 27, 8, 0, 0))
  })

  test('已过今日重置点 → 次日', () => {
    const now = Date.UTC(2026, 10, 27, 9, 0, 0)
    expect(computeNextDayResetMs(now, { resetHourUtc: 8 })).toBe(Date.UTC(2026, 10, 28, 8, 0, 0))
  })
})

describe('reserveQuota / reconcileQuota', () => {
  test('付费条目（无 freeTier）恒 allowed 仍计数', () => {
    const state = createEmptyQuotaLedgerState()
    const now = 1_000_000
    const r1 = reserveQuota({
      state,
      candidateId: 'deepseek-flash',
      estimatedTokens: 50,
      nowMs: now
    })
    expect(r1.allowed).toBe(true)
    const snap = snapshotQuota({ state, candidateId: 'deepseek-flash', nowMs: now })
    expect(snap?.minuteWindow.requestCount).toBe(1)
    expect(snap?.minuteWindow.tokenEstimate).toBe(50)
  })

  test('分钟窗口滚动后计数清零', () => {
    const state = createEmptyQuotaLedgerState()
    const t0 = 1_000_000
    expect(
      reserveQuota({
        state,
        candidateId: 'gemini',
        estimatedTokens: 10,
        nowMs: t0,
        freeTier: FREE
      }).allowed
    ).toBe(true)
    expect(
      reserveQuota({
        state,
        candidateId: 'gemini',
        estimatedTokens: 10,
        nowMs: t0 + 1,
        freeTier: FREE
      }).allowed
    ).toBe(true)
    // rpm=2 → 第三次同窗拒绝
    expect(
      reserveQuota({
        state,
        candidateId: 'gemini',
        estimatedTokens: 10,
        nowMs: t0 + 2,
        freeTier: FREE
      })
    ).toEqual({ allowed: false, reason: 'minute_limit' })

    // 滚到下一分钟窗
    const after = reserveQuota({
      state,
      candidateId: 'gemini',
      estimatedTokens: 10,
      nowMs: t0 + 60_000,
      freeTier: FREE
    })
    expect(after.allowed).toBe(true)
    const snap = snapshotQuota({
      state,
      candidateId: 'gemini',
      nowMs: t0 + 60_000,
      freeTier: FREE
    })
    expect(snap?.minuteWindow.requestCount).toBe(1)
  })

  test('日重置后日窗清零', () => {
    const state = createEmptyQuotaLedgerState()
    const dayStart = Date.UTC(2026, 10, 27, 0, 0, 0)
    for (let i = 0; i < 5; i++) {
      const r = reserveQuota({
        state,
        candidateId: 'gemini',
        estimatedTokens: 1,
        nowMs: dayStart + i * 61_000, // 错开分钟窗
        freeTier: FREE
      })
      expect(r.allowed).toBe(true)
    }
    expect(
      reserveQuota({
        state,
        candidateId: 'gemini',
        estimatedTokens: 1,
        nowMs: dayStart + 5 * 61_000,
        freeTier: FREE
      })
    ).toEqual({ allowed: false, reason: 'daily_limit' })

    const nextDay = Date.UTC(2026, 10, 28, 0, 0, 0)
    const afterReset = reserveQuota({
      state,
      candidateId: 'gemini',
      estimatedTokens: 1,
      nowMs: nextDay,
      freeTier: FREE
    })
    expect(afterReset.allowed).toBe(true)
    const snap = snapshotQuota({
      state,
      candidateId: 'gemini',
      nowMs: nextDay,
      freeTier: FREE
    })
    expect(snap?.dayWindow.requestCount).toBe(1)
  })

  test('冷却生效与过期', () => {
    const state = createEmptyQuotaLedgerState()
    const now = 2_000_000
    const reserved = reserveQuota({
      state,
      candidateId: 'gemini',
      estimatedTokens: 10,
      nowMs: now,
      freeTier: FREE
    })
    expect(reserved.allowed).toBe(true)
    if (!reserved.allowed) return

    reconcileQuota({
      state,
      candidateId: 'gemini',
      reservationId: reserved.reservationId,
      outcome: 'rate_limit_minute',
      nowMs: now,
      freeTier: FREE
    })

    expect(
      reserveQuota({
        state,
        candidateId: 'gemini',
        estimatedTokens: 1,
        nowMs: now + 1,
        freeTier: FREE
      })
    ).toEqual({ allowed: false, reason: 'cooldown' })

    expect(
      reserveQuota({
        state,
        candidateId: 'gemini',
        estimatedTokens: 1,
        nowMs: now + DEFAULT_MINUTE_COOLDOWN_MS,
        freeTier: FREE
      }).allowed
    ).toBe(true)
  })

  test('quota_exhausted_daily 冷却到次日重置', () => {
    const state = createEmptyQuotaLedgerState()
    const now = Date.UTC(2026, 10, 27, 12, 0, 0)
    const reserved = reserveQuota({
      state,
      candidateId: 'gemini',
      estimatedTokens: 10,
      nowMs: now,
      freeTier: FREE
    })
    expect(reserved.allowed).toBe(true)
    if (!reserved.allowed) return

    reconcileQuota({
      state,
      candidateId: 'gemini',
      reservationId: reserved.reservationId,
      outcome: 'quota_exhausted_daily',
      nowMs: now,
      freeTier: FREE
    })
    const snap = snapshotQuota({ state, candidateId: 'gemini', nowMs: now, freeTier: FREE })
    expect(snap?.cooldownUntil).toBe(snap?.dayWindow.resetAtMs)
    expect(snap?.lastErrorKind).toBe('quota_exhausted_daily')
  })

  test('payment_required 设长冷却与 needsManualRecovery', () => {
    const state = createEmptyQuotaLedgerState()
    const now = 3_000_000
    const reserved = reserveQuota({
      state,
      candidateId: 'paid',
      estimatedTokens: 10,
      nowMs: now
    })
    expect(reserved.allowed).toBe(true)
    if (!reserved.allowed) return

    reconcileQuota({
      state,
      candidateId: 'paid',
      reservationId: reserved.reservationId,
      outcome: 'payment_required',
      nowMs: now
    })
    const snap = snapshotQuota({ state, candidateId: 'paid', nowMs: now })
    expect(snap?.cooldownUntil).toBe(now + LONG_COOLDOWN_MS)
    expect(snap?.needsManualRecovery).toBe(true)
    expect(snap?.lastErrorKind).toBe('payment_required')
  })

  test('misconfigured 同样设长冷却与 needsManualRecovery', () => {
    const state = createEmptyQuotaLedgerState()
    const now = 3_100_000
    const reserved = reserveQuota({
      state,
      candidateId: 'paid',
      estimatedTokens: 10,
      nowMs: now
    })
    expect(reserved.allowed).toBe(true)
    if (!reserved.allowed) return

    reconcileQuota({
      state,
      candidateId: 'paid',
      reservationId: reserved.reservationId,
      outcome: 'misconfigured',
      nowMs: now
    })
    const snap = snapshotQuota({ state, candidateId: 'paid', nowMs: now })
    expect(snap?.cooldownUntil).toBe(now + LONG_COOLDOWN_MS)
    expect(snap?.needsManualRecovery).toBe(true)
    expect(snap?.lastErrorKind).toBe('misconfigured')
  })

  test('snapshot 含 dailyRemainingRatio（rpd/tpd 取最小）', () => {
    const state = createEmptyQuotaLedgerState()
    const now = 5_000_000
    expect(
      reserveQuota({
        state,
        candidateId: 'gemini',
        estimatedTokens: 100,
        nowMs: now,
        freeTier: FREE
      }).allowed
    ).toBe(true)
    const snap = snapshotQuota({
      state,
      candidateId: 'gemini',
      nowMs: now,
      freeTier: FREE
    })
    // rpd=5 used=1 → 0.8；tpd=500 used=100 → 0.8
    expect(snap?.dailyRemainingRatio).toBe(0.8)
    expect(computeDailyRemainingRatio({ requestCount: 4, tokenEstimate: 100 }, FREE)).toBeCloseTo(
      0.2
    )
  })

  test('预留后对账校准估算 token', () => {
    const state = createEmptyQuotaLedgerState()
    const now = 4_000_000
    const reserved = reserveQuota({
      state,
      candidateId: 'deepseek-flash',
      estimatedTokens: 100,
      nowMs: now
    })
    expect(reserved.allowed).toBe(true)
    if (!reserved.allowed) return

    reconcileQuota({
      state,
      candidateId: 'deepseek-flash',
      reservationId: reserved.reservationId,
      actualTokens: 40,
      outcome: 'success',
      nowMs: now + 10
    })
    const snap = snapshotQuota({ state, candidateId: 'deepseek-flash', nowMs: now + 10 })
    expect(snap?.minuteWindow.tokenEstimate).toBe(40)
    expect(snap?.dayWindow.tokenEstimate).toBe(40)
    expect(snap?.pendingCount).toBe(0)
  })

  test('candidateMissing → not_found', () => {
    const state = createEmptyQuotaLedgerState()
    expect(
      reserveQuota({
        state,
        candidateId: 'missing',
        estimatedTokens: 1,
        nowMs: 1,
        candidateMissing: true
      })
    ).toEqual({ allowed: false, reason: 'not_found' })
    expect(Object.keys(state.buckets)).toHaveLength(0)
  })
})
