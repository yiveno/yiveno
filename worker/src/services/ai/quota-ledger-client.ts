/**
 * 额度账本客户端（Batch 2）。
 *
 * 绑定未就绪（本地测试无 DO / 部署前）时降级为 no-op 并打 warn，不得让请求失败。
 */

import type { Env } from '../../types/env'
import { warn as logWarn } from '../../utils/logger'
import type { QuotaReconcileOutcome, QuotaReserveResult, QuotaSnapshot } from './quota-ledger-state'

/** 账本端口（DO stub 或 no-op）。 */
export type QuotaLedgerPort = {
  /**
   * false = 绑定缺失 / stub 失败后的 no-op；
   * quota 模式应跳过 reserve，直接按序尝试候选。
   * 缺省视为可用。
   */
  readonly available?: boolean
  reserve(candidateId: string, estimatedTokens: number, nowMs: number): Promise<QuotaReserveResult>
  reconcile(
    candidateId: string,
    reservationId: string,
    actualTokens: number | undefined,
    outcome: QuotaReconcileOutcome,
    nowMs: number,
    retryAfterMs?: number
  ): Promise<void>
  snapshot(candidateId: string, nowMs: number): Promise<QuotaSnapshot | null>
}

const NOOP_ALLOW: QuotaReserveResult = {
  allowed: true,
  reservationId: 'noop'
}

/** 内存 no-op：reserve 恒允许；reconcile / snapshot 空操作；available=false。 */
export function createNoOpQuotaLedger(reason: string): QuotaLedgerPort {
  logWarn('ai_quota_ledger_noop', { reason })
  return {
    available: false,
    async reserve() {
      return NOOP_ALLOW
    },
    async reconcile() {
      /* no-op */
    },
    async snapshot() {
      return null
    }
  }
}

type LedgerStub = {
  reserve(candidateId: string, estimatedTokens: number, nowMs: number): Promise<QuotaReserveResult>
  reconcile(
    candidateId: string,
    reservationId: string,
    actualTokens: number | undefined,
    outcome: QuotaReconcileOutcome,
    nowMs: number,
    retryAfterMs?: number
  ): Promise<void>
  snapshot(candidateId: string, nowMs: number): Promise<QuotaSnapshot | null>
}

/**
 * 解析账本端口。
 * 无 AI_QUOTA_LEDGER 绑定 → no-op；get stub 抛错 → no-op。
 */
export function resolveQuotaLedger(env: Env): QuotaLedgerPort {
  const ns = env.AI_QUOTA_LEDGER
  if (!ns) {
    return createNoOpQuotaLedger('binding_missing')
  }
  try {
    const id = ns.idFromName('ai-quota-ledger-v1')
    const stub = ns.get(id) as unknown as LedgerStub
    return {
      reserve: (candidateId, estimatedTokens, nowMs) =>
        stub.reserve(candidateId, estimatedTokens, nowMs),
      reconcile: (candidateId, reservationId, actualTokens, outcome, nowMs, retryAfterMs) =>
        stub.reconcile(candidateId, reservationId, actualTokens, outcome, nowMs, retryAfterMs),
      snapshot: (candidateId, nowMs) => stub.snapshot(candidateId, nowMs)
    }
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    return createNoOpQuotaLedger(`stub_failed:${detail}`)
  }
}
