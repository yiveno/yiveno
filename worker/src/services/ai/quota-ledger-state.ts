/**
 * AI 额度账本纯状态机（Batch 2）。
 *
 * Durable Object / 内存假实现共用；便于单测窗口滚动、日重置、冷却与对账。
 */

import type { AiProviderErrorKind } from './ai-provider-error'
import type { AiCandidateFreeTier } from './ai-candidate-registry'

const MINUTE_MS = 60_000
const DAY_MS = 86_400_000
/** rate_limit_minute 默认短冷却 */
export const DEFAULT_MINUTE_COOLDOWN_MS = 60_000
/** payment_required / auth_failed 长冷却（须人工恢复） */
export const LONG_COOLDOWN_MS = 24 * 60 * 60 * 1000

export type QuotaMinuteWindow = {
  requestCount: number
  tokenEstimate: number
  windowStartMs: number
}

export type QuotaDayWindow = {
  requestCount: number
  tokenEstimate: number
  /** 下次日窗重置时刻（epoch ms） */
  resetAtMs: number
}

export type QuotaPendingReservation = {
  estimatedTokens: number
  createdAtMs: number
}

/** 单候选桶。 */
export type QuotaCandidateBucket = {
  minuteWindow: QuotaMinuteWindow
  dayWindow: QuotaDayWindow
  cooldownUntil?: number
  lastErrorKind?: AiProviderErrorKind
  /** 长冷却且需人工恢复（payment / auth） */
  needsManualRecovery?: boolean
  pending: Record<string, QuotaPendingReservation>
}

export type QuotaLedgerState = {
  buckets: Record<string, QuotaCandidateBucket>
}

export type QuotaReserveDenyReason =
  | 'minute_limit' // 分钟窗超限
  | 'daily_limit' // 日窗超限
  | 'cooldown' // 冷却中
  | 'not_found' // 未知候选（由调用方在查注册表后传入）

export type QuotaReserveResult =
  { allowed: true; reservationId: string } | { allowed: false; reason: QuotaReserveDenyReason }

export type QuotaReconcileOutcome = 'success' | AiProviderErrorKind

export type QuotaSnapshot = {
  candidateId: string
  minuteWindow: QuotaMinuteWindow
  dayWindow: QuotaDayWindow
  cooldownUntil?: number
  lastErrorKind?: AiProviderErrorKind
  needsManualRecovery?: boolean
  pendingCount: number
}

export function createEmptyQuotaLedgerState(): QuotaLedgerState {
  return { buckets: {} }
}

/**
 * 计算下一日窗重置时刻。
 * 优先用 freeTier.resetHourUtc（UTC 整点）；缺省则次日 UTC 0 点。
 */
export function computeNextDayResetMs(
  nowMs: number,
  freeTier?: Pick<AiCandidateFreeTier, 'resetHourUtc' | 'resetTimezone'>
): number {
  const hour = clampHour(freeTier?.resetHourUtc ?? 0)
  const d = new Date(nowMs)
  let reset = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hour, 0, 0, 0)
  if (reset <= nowMs) {
    reset += DAY_MS
  }
  return reset
}

function clampHour(hour: number): number {
  if (!Number.isFinite(hour)) return 0
  return Math.min(23, Math.max(0, Math.floor(hour)))
}

function emptyBucket(nowMs: number, freeTier?: AiCandidateFreeTier): QuotaCandidateBucket {
  return {
    minuteWindow: { requestCount: 0, tokenEstimate: 0, windowStartMs: nowMs },
    dayWindow: {
      requestCount: 0,
      tokenEstimate: 0,
      resetAtMs: computeNextDayResetMs(nowMs, freeTier)
    },
    pending: {}
  }
}

function rollWindows(
  bucket: QuotaCandidateBucket,
  nowMs: number,
  freeTier?: AiCandidateFreeTier
): void {
  if (nowMs - bucket.minuteWindow.windowStartMs >= MINUTE_MS) {
    bucket.minuteWindow = { requestCount: 0, tokenEstimate: 0, windowStartMs: nowMs }
  }
  if (nowMs >= bucket.dayWindow.resetAtMs) {
    bucket.dayWindow = {
      requestCount: 0,
      tokenEstimate: 0,
      resetAtMs: computeNextDayResetMs(nowMs, freeTier)
    }
  }
}

function ensureBucket(
  state: QuotaLedgerState,
  candidateId: string,
  nowMs: number,
  freeTier?: AiCandidateFreeTier
): QuotaCandidateBucket {
  let bucket = state.buckets[candidateId]
  if (!bucket) {
    bucket = emptyBucket(nowMs, freeTier)
    state.buckets[candidateId] = bucket
  } else {
    rollWindows(bucket, nowMs, freeTier)
  }
  return bucket
}

function makeReservationId(nowMs: number): string {
  return `r-${nowMs}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * 原子预留：检查冷却 / 分钟 / 日限额后记账。
 * 无 freeTier → 付费条目：恒 allowed，仍计数。
 * candidateMissing=true → not_found（不改状态）。
 */
export function reserveQuota(input: {
  state: QuotaLedgerState
  candidateId: string
  estimatedTokens: number
  nowMs: number
  freeTier?: AiCandidateFreeTier
  /** 注册表未找到候选 */
  candidateMissing?: boolean
}): QuotaReserveResult {
  if (input.candidateMissing) {
    return { allowed: false, reason: 'not_found' }
  }

  const estimated = Math.max(0, Math.floor(input.estimatedTokens))
  const bucket = ensureBucket(input.state, input.candidateId, input.nowMs, input.freeTier)

  if (bucket.cooldownUntil !== undefined && input.nowMs < bucket.cooldownUntil) {
    return { allowed: false, reason: 'cooldown' }
  }

  const freeTier = input.freeTier
  if (freeTier) {
    if (
      (freeTier.rpm !== undefined && bucket.minuteWindow.requestCount + 1 > freeTier.rpm) ||
      (freeTier.tpm !== undefined && bucket.minuteWindow.tokenEstimate + estimated > freeTier.tpm)
    ) {
      return { allowed: false, reason: 'minute_limit' }
    }
    if (
      (freeTier.rpd !== undefined && bucket.dayWindow.requestCount + 1 > freeTier.rpd) ||
      (freeTier.tpd !== undefined && bucket.dayWindow.tokenEstimate + estimated > freeTier.tpd)
    ) {
      return { allowed: false, reason: 'daily_limit' }
    }
  }

  const reservationId = makeReservationId(input.nowMs)
  bucket.minuteWindow.requestCount += 1
  bucket.minuteWindow.tokenEstimate += estimated
  bucket.dayWindow.requestCount += 1
  bucket.dayWindow.tokenEstimate += estimated
  bucket.pending[reservationId] = {
    estimatedTokens: estimated,
    createdAtMs: input.nowMs
  }

  return { allowed: true, reservationId }
}

/**
 * 用真实 usage / 错误 kind 对账。
 * - success：用 actualTokens 校准估算
 * - quota_exhausted_daily：冷却到次日重置
 * - rate_limit_minute：短冷却（retryAfterMs 或默认 60s）
 * - payment_required / auth_failed：长冷却 + needsManualRecovery
 */
export function reconcileQuota(input: {
  state: QuotaLedgerState
  candidateId: string
  reservationId: string
  actualTokens?: number
  outcome: QuotaReconcileOutcome
  nowMs: number
  freeTier?: AiCandidateFreeTier
  retryAfterMs?: number
}): void {
  const bucket = ensureBucket(input.state, input.candidateId, input.nowMs, input.freeTier)
  const pending = bucket.pending[input.reservationId]
  const estimated = pending?.estimatedTokens ?? 0
  if (pending) {
    delete bucket.pending[input.reservationId]
  }

  if (input.outcome === 'success') {
    const actual =
      input.actualTokens !== undefined && Number.isFinite(input.actualTokens)
        ? Math.max(0, Math.floor(input.actualTokens))
        : estimated
    const delta = actual - estimated
    bucket.minuteWindow.tokenEstimate = Math.max(0, bucket.minuteWindow.tokenEstimate + delta)
    bucket.dayWindow.tokenEstimate = Math.max(0, bucket.dayWindow.tokenEstimate + delta)
    delete bucket.lastErrorKind
    return
  }

  bucket.lastErrorKind = input.outcome

  if (input.outcome === 'quota_exhausted_daily') {
    bucket.cooldownUntil = bucket.dayWindow.resetAtMs
    return
  }

  if (input.outcome === 'rate_limit_minute') {
    const cool =
      input.retryAfterMs !== undefined && Number.isFinite(input.retryAfterMs)
        ? Math.max(0, Math.floor(input.retryAfterMs))
        : DEFAULT_MINUTE_COOLDOWN_MS
    bucket.cooldownUntil = input.nowMs + cool
    return
  }

  if (input.outcome === 'payment_required' || input.outcome === 'auth_failed') {
    bucket.cooldownUntil = input.nowMs + LONG_COOLDOWN_MS
    bucket.needsManualRecovery = true
  }
}

/** 只读快照（会滚动过期窗口）。 */
export function snapshotQuota(input: {
  state: QuotaLedgerState
  candidateId: string
  nowMs: number
  freeTier?: AiCandidateFreeTier
}): QuotaSnapshot | null {
  const existing = input.state.buckets[input.candidateId]
  if (!existing) return null
  rollWindows(existing, input.nowMs, input.freeTier)
  return {
    candidateId: input.candidateId,
    minuteWindow: { ...existing.minuteWindow },
    dayWindow: { ...existing.dayWindow },
    ...(existing.cooldownUntil !== undefined ? { cooldownUntil: existing.cooldownUntil } : {}),
    ...(existing.lastErrorKind !== undefined ? { lastErrorKind: existing.lastErrorKind } : {}),
    ...(existing.needsManualRecovery !== undefined
      ? { needsManualRecovery: existing.needsManualRecovery }
      : {}),
    pendingCount: Object.keys(existing.pending).length
  }
}
