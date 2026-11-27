/**
 * AI 额度账本 Durable Object（Batch 2）。
 *
 * 按 candidateId 分桶；reserve / reconcile / snapshot 委托纯状态机。
 * 须在 worker 入口 export 本类，并由 wrangler durable_objects + migrations 绑定。
 */

import { DurableObject } from 'cloudflare:workers'
import { getCandidate } from './ai-candidate-registry'
import {
  createEmptyQuotaLedgerState,
  reconcileQuota,
  reserveQuota,
  snapshotQuota,
  type QuotaLedgerState,
  type QuotaReconcileOutcome,
  type QuotaReserveResult,
  type QuotaSnapshot
} from './quota-ledger-state'

const STORAGE_KEY = 'quota-ledger-v1'

/**
 * 全局额度账本 DO（单实例名 ai-quota-ledger-v1）。
 * Env 泛型用 Cloudflare.Env；业务 Env 绑定在 stub 侧解析。
 */
export class AiQuotaLedger extends DurableObject {
  private async loadState(): Promise<QuotaLedgerState> {
    const stored = await this.ctx.storage.get<QuotaLedgerState>(STORAGE_KEY)
    if (stored && typeof stored === 'object' && stored.buckets) {
      return stored
    }
    return createEmptyQuotaLedgerState()
  }

  private async saveState(state: QuotaLedgerState): Promise<void> {
    await this.ctx.storage.put(STORAGE_KEY, state)
  }

  /**
   * 原子预留。
   * 未知 candidateId → not_found；无 freeTier 付费条目恒 allowed 仍计数。
   */
  async reserve(
    candidateId: string,
    estimatedTokens: number,
    nowMs: number
  ): Promise<QuotaReserveResult> {
    const candidate = getCandidate(candidateId)
    const state = await this.loadState()
    const result = reserveQuota({
      state,
      candidateId,
      estimatedTokens,
      nowMs,
      ...(candidate?.freeTier !== undefined ? { freeTier: candidate.freeTier } : {}),
      candidateMissing: candidate === undefined
    })
    if (result.allowed) {
      await this.saveState(state)
    }
    return result
  }

  /**
   * 真实 usage / 错误 kind 对账。
   */
  async reconcile(
    candidateId: string,
    reservationId: string,
    actualTokens: number | undefined,
    outcome: QuotaReconcileOutcome,
    nowMs: number,
    retryAfterMs?: number
  ): Promise<void> {
    const candidate = getCandidate(candidateId)
    const state = await this.loadState()
    reconcileQuota({
      state,
      candidateId,
      reservationId,
      outcome,
      nowMs,
      ...(actualTokens !== undefined ? { actualTokens } : {}),
      ...(candidate?.freeTier !== undefined ? { freeTier: candidate.freeTier } : {}),
      ...(retryAfterMs !== undefined ? { retryAfterMs } : {})
    })
    await this.saveState(state)
  }

  /** 当前窗口用量快照。 */
  async snapshot(candidateId: string, nowMs: number): Promise<QuotaSnapshot | null> {
    const candidate = getCandidate(candidateId)
    const state = await this.loadState()
    return snapshotQuota({
      state,
      candidateId,
      nowMs,
      ...(candidate?.freeTier !== undefined ? { freeTier: candidate.freeTier } : {})
    })
  }
}
