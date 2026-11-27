/**
 * AI chat 路由层（Batch 3）：single / shadow / quota 模式。
 *
 * - single（缺省 · kill switch）：与现行 resolveAiChatProvider.complete 逐字一致，不触账本、不查注册表。
 * - shadow：查候选 → reserve → 记决策日志 → 仍走现行单 provider；成功/失败 reconcile。
 * - quota：按注册表顺序真实切换候选；隐私门 / reserve / 失败 failover；账本不可用或无合格候选时安全退化。
 *
 * 不切换生产流量：默认 AI_ROUTING_MODE 缺省 = single。
 */

import type { AiChatTaskKind } from '../../config/ai-task-kind'
import { AI_CHAT_TASK_KIND_DEFAULT } from '../../config/ai-task-kind'
import type { Env } from '../../types/env'
import { info as logInfo, warn as logWarn } from '../../utils/logger'
import { listRoutableCandidates, type AiCandidateEntry } from './ai-candidate-registry'
import {
  resolveAiChatProvider,
  type AiChatCompleteRequest,
  type AiChatCompleteResult,
  type AiChatProvider,
  type AiChatRequestPriority
} from './ai-chat-provider'
import { AiProviderError } from './ai-provider-error'
import { deepseekAiChatProvider } from './deepseek-ai-chat-provider'
import { gatewayCompatAiChatProvider } from './gateway-compat-ai-chat-provider'
import { resolveQuotaLedger, type QuotaLedgerPort } from './quota-ledger-client'
import {
  computeDailyRemainingRatio,
  type QuotaReconcileOutcome,
  type QuotaReserveResult
} from './quota-ledger-state'

/** 路由模式。 */
export type AiRoutingMode = 'single' | 'shadow' | 'quota'

/**
 * background 优先级下，免费候选（有 freeTier）日窗剩余比例须**高于**此值才可 reserve。
 * 保护 interactive 高峰；付费候选与 interactive 不受此限。
 */
export const BACKGROUND_FREE_TIER_DAILY_RESERVE_FLOOR = 0.2

/** 带路由的补全入口。 */
export type AiChatCompleter = {
  complete(env: Env, request: AiChatCompleteRequest): Promise<AiChatCompleteResult>
}

/** 可注入依赖（单测用）。 */
export type AiChatRouterDeps = {
  resolveProvider?: (env: Env) => AiChatProvider
  resolveLedger?: (env: Env) => QuotaLedgerPort
  nowMs?: () => number
  /** 覆盖 listRoutableCandidates（注入假候选） */
  listCandidates?: (taskKind: AiChatTaskKind) => AiCandidateEntry[]
  /** 按候选 providerId 解析具体 adapter */
  resolveProviderForCandidate?: (providerId: AiCandidateEntry['providerId']) => AiChatProvider
}

/**
 * 解析 AI_ROUTING_MODE。
 * 缺省 / 空 → single；未知值 → AiProviderError misconfigured。
 */
export function parseAiRoutingMode(raw: string | undefined): AiRoutingMode {
  const trimmed = (raw ?? '').trim().toLowerCase()
  if (trimmed === '' || trimmed === 'single') return 'single'
  if (trimmed === 'shadow') return 'shadow'
  if (trimmed === 'quota') return 'quota'
  throw new AiProviderError({
    kind: 'misconfigured',
    providerId: 'router',
    causeMessage: `ai_routing_mode_unsupported:${trimmed}`
  })
}

/**
 * Token 估算（仅 shadow/quota 预留）：
 * prompt 字符数 / 4（近似英文 token）+ maxTokens 上限。
 * 真实用量以 usage.tokensUsed（或 prompt+completion）对账为准。
 */
export function estimateTokensForRequest(request: AiChatCompleteRequest): number {
  const promptChars = measurePromptChars(request)
  const promptEst = Math.ceil(promptChars / 4)
  const maxOut =
    request.maxTokens !== undefined && Number.isFinite(request.maxTokens)
      ? Math.max(0, Math.floor(request.maxTokens))
      : 0
  return promptEst + maxOut
}

function measurePromptChars(request: AiChatCompleteRequest): number {
  if (request.messages && request.messages.length > 0) {
    return request.messages.reduce((sum, m) => sum + (m.content?.length ?? 0), 0)
  }
  return request.prompt?.length ?? 0
}

function resolveTaskKind(request: AiChatCompleteRequest): AiChatTaskKind {
  return request.taskKind ?? AI_CHAT_TASK_KIND_DEFAULT
}

function resolvePriority(request: AiChatCompleteRequest): AiChatRequestPriority {
  return request.priority ?? 'interactive'
}

/** 按候选 providerId 解析 adapter（可注入）。 */
export function defaultResolveProviderForCandidate(
  providerId: AiCandidateEntry['providerId']
): AiChatProvider {
  switch (providerId) {
    case 'deepseek':
      return deepseekAiChatProvider
    case 'gateway-compat':
      return gatewayCompatAiChatProvider
    default: {
      const _exhaustive: never = providerId
      throw new AiProviderError({
        kind: 'misconfigured',
        providerId: String(_exhaustive),
        causeMessage: `ai_candidate_provider_unsupported:${String(providerId)}`
      })
    }
  }
}

/**
 * 返回带路由的 complete。
 * resolveAiChatProvider 保持不变；新代码优先走本函数。
 */
export function resolveAiChatCompleter(env: Env, deps?: AiChatRouterDeps): AiChatCompleter {
  return {
    complete: (innerEnv, request) => routedComplete(innerEnv, request, deps)
  }
}

/** 路由主路径（导出供单测注入 deps）。 */
export async function routedComplete(
  env: Env,
  request: AiChatCompleteRequest,
  deps?: AiChatRouterDeps
): Promise<AiChatCompleteResult> {
  const mode = parseAiRoutingMode(env.AI_ROUTING_MODE)
  const resolveProvider = deps?.resolveProvider ?? resolveAiChatProvider

  // kill switch：与 Batch 2 single 逐字一致——不触账本、不查注册表
  if (mode === 'single') {
    return resolveProvider(env).complete(env, request)
  }

  if (mode === 'shadow') {
    return shadowComplete(env, request, mode, {
      resolveProvider,
      resolveLedger: deps?.resolveLedger ?? resolveQuotaLedger,
      nowMs: deps?.nowMs ?? Date.now,
      listCandidates: deps?.listCandidates ?? listRoutableCandidates
    })
  }

  return quotaComplete(env, request, {
    resolveProvider,
    resolveLedger: deps?.resolveLedger ?? resolveQuotaLedger,
    nowMs: deps?.nowMs ?? Date.now,
    listCandidates: deps?.listCandidates ?? listRoutableCandidates,
    resolveProviderForCandidate:
      deps?.resolveProviderForCandidate ?? defaultResolveProviderForCandidate
  })
}

async function shadowComplete(
  env: Env,
  request: AiChatCompleteRequest,
  mode: AiRoutingMode,
  deps: {
    resolveProvider: (env: Env) => AiChatProvider
    resolveLedger: (env: Env) => QuotaLedgerPort
    nowMs: () => number
    listCandidates: (taskKind: AiChatTaskKind) => AiCandidateEntry[]
  }
): Promise<AiChatCompleteResult> {
  const taskKind = resolveTaskKind(request)
  const priority = resolvePriority(request)
  const requestId = request.requestId
  const candidates = deps.listCandidates(taskKind)
  const chosen = candidates[0]
  const chosenCandidateId = chosen?.candidateId ?? null
  const estimatedTokens = estimateTokensForRequest(request)
  const nowMs = deps.nowMs()

  const ledger = deps.resolveLedger(env)
  let reservationId: string | undefined
  let reserveAllowed: boolean | null = null
  let reserveReason: string | undefined

  if (chosenCandidateId) {
    const reserveResult = await safeReserve(ledger, chosenCandidateId, estimatedTokens, nowMs)
    reserveAllowed = reserveResult.allowed
    if (reserveResult.allowed) {
      reservationId = reserveResult.reservationId
    } else {
      reserveReason = reserveResult.reason
    }
  }

  logInfo('ai_routing_decision', {
    requestId: requestId ?? null,
    taskKind,
    priority,
    mode,
    chosenCandidateId,
    estimatedTokens,
    reserveAllowed,
    reserveReason: reserveReason ?? null
    // 不含 prompt / key
  })

  const provider = deps.resolveProvider(env)
  try {
    const result = await provider.complete(env, request)
    if (chosenCandidateId && reservationId) {
      const actual = result.tokensUsed ?? sumDefined(result.promptTokens, result.completionTokens)
      await safeReconcile(ledger, {
        candidateId: chosenCandidateId,
        reservationId,
        outcome: 'success',
        nowMs: deps.nowMs(),
        ...(actual !== undefined ? { actualTokens: actual } : {})
      })
    }
    return {
      ...result,
      attempts: 1
    }
  } catch (err) {
    if (chosenCandidateId && reservationId && err instanceof AiProviderError) {
      await safeReconcile(ledger, {
        candidateId: chosenCandidateId,
        reservationId,
        outcome: err.kind,
        nowMs: deps.nowMs(),
        ...(err.retryAfterMs !== undefined ? { retryAfterMs: err.retryAfterMs } : {})
      })
    }
    throw err
  }
}

async function quotaComplete(
  env: Env,
  request: AiChatCompleteRequest,
  deps: {
    resolveProvider: (env: Env) => AiChatProvider
    resolveLedger: (env: Env) => QuotaLedgerPort
    nowMs: () => number
    listCandidates: (taskKind: AiChatTaskKind) => AiCandidateEntry[]
    resolveProviderForCandidate: (providerId: AiCandidateEntry['providerId']) => AiChatProvider
  }
): Promise<AiChatCompleteResult> {
  const taskKind = resolveTaskKind(request)
  const priority = resolvePriority(request)
  const requestId = request.requestId
  const estimatedTokens = estimateTokensForRequest(request)
  const candidates = deps.listCandidates(taskKind)

  if (candidates.length === 0) {
    logWarn('ai_routing_quota_no_candidates', {
      requestId: requestId ?? null,
      taskKind,
      message: 'quota 无合格候选，回落 resolveAiChatProvider 单路'
    })
    return deps.resolveProvider(env).complete(env, request)
  }

  let ledger: QuotaLedgerPort
  let ledgerAvailable = true
  try {
    ledger = deps.resolveLedger(env)
    if (ledger.available === false) {
      ledgerAvailable = false
      logWarn('ai_routing_quota_ledger_unavailable', {
        requestId: requestId ?? null,
        taskKind,
        message: '账本不可用，跳过 reserve 按序尝试候选'
      })
    }
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    logWarn('ai_routing_quota_ledger_unavailable', {
      requestId: requestId ?? null,
      taskKind,
      detail,
      message: '账本解析失败，跳过 reserve 按序尝试候选'
    })
    ledgerAvailable = false
    ledger = {
      available: false,
      async reserve() {
        return { allowed: true, reservationId: 'noop-ledger-throw' }
      },
      async reconcile() {
        /* no-op */
      },
      async snapshot() {
        return null
      }
    }
  }

  let attemptIndex = 0
  let providerAttempts = 0
  let lastFallbackReason: string | undefined
  let lastError: AiProviderError | undefined
  let anyProviderCalled = false

  for (const candidate of candidates) {
    // 隐私门：free_terms_unverified 永不进入 quota 选择
    if (candidate.privacyTier === 'free_terms_unverified') {
      lastFallbackReason = 'privacy_free_terms_unverified'
      logInfo('ai_routing_attempt', {
        requestId: requestId ?? null,
        taskKind,
        priority,
        candidateId: candidate.candidateId,
        attemptIndex,
        reserveResult: 'skipped_privacy',
        outcome: 'skipped',
        actualTokens: null
      })
      attemptIndex += 1
      continue
    }

    let reservationId: string | undefined

    if (ledgerAvailable) {
      // background 预留线：免费候选日窗剩余须高于 FLOOR
      if (priority === 'background' && candidate.freeTier) {
        const blocked = await isBlockedByBackgroundReserveFloor(ledger, candidate, deps.nowMs())
        if (blocked) {
          lastFallbackReason = 'background_reserve_floor'
          logInfo('ai_routing_attempt', {
            requestId: requestId ?? null,
            taskKind,
            priority,
            candidateId: candidate.candidateId,
            attemptIndex,
            reserveResult: 'skipped_background_floor',
            outcome: 'skipped',
            actualTokens: null
          })
          attemptIndex += 1
          continue
        }
      }

      const reserveResult = await safeReserve(
        ledger,
        candidate.candidateId,
        estimatedTokens,
        deps.nowMs()
      )
      if (!reserveResult.allowed) {
        lastFallbackReason = reserveResult.reason
        logInfo('ai_routing_attempt', {
          requestId: requestId ?? null,
          taskKind,
          priority,
          candidateId: candidate.candidateId,
          attemptIndex,
          reserveResult: reserveResult.reason,
          outcome: 'skipped',
          actualTokens: null
        })
        attemptIndex += 1
        continue
      }
      reservationId = reserveResult.reservationId
    }

    const provider = deps.resolveProviderForCandidate(candidate.providerId)
    const candidateRequest: AiChatCompleteRequest = {
      ...request,
      model: candidate.model
    }
    anyProviderCalled = true
    providerAttempts += 1

    try {
      const result = await provider.complete(env, candidateRequest)
      const actual = result.tokensUsed ?? sumDefined(result.promptTokens, result.completionTokens)
      if (reservationId) {
        await safeReconcile(ledger, {
          candidateId: candidate.candidateId,
          reservationId,
          outcome: 'success',
          nowMs: deps.nowMs(),
          ...(actual !== undefined ? { actualTokens: actual } : {})
        })
      }
      logInfo('ai_routing_attempt', {
        requestId: requestId ?? null,
        taskKind,
        priority,
        candidateId: candidate.candidateId,
        attemptIndex,
        reserveResult: ledgerAvailable ? 'allowed' : 'skipped_ledger_unavailable',
        outcome: 'success',
        actualTokens: actual ?? null
      })
      return {
        ...result,
        attempts: providerAttempts,
        ...(lastFallbackReason !== undefined ? { fallbackReason: lastFallbackReason } : {})
      }
    } catch (err) {
      if (!(err instanceof AiProviderError)) {
        throw err
      }
      lastError = err
      lastFallbackReason = err.kind
      if (reservationId) {
        await safeReconcile(ledger, {
          candidateId: candidate.candidateId,
          reservationId,
          outcome: err.kind,
          nowMs: deps.nowMs(),
          ...(err.retryAfterMs !== undefined ? { retryAfterMs: err.retryAfterMs } : {})
        })
      }
      logInfo('ai_routing_attempt', {
        requestId: requestId ?? null,
        taskKind,
        priority,
        candidateId: candidate.candidateId,
        attemptIndex,
        reserveResult: ledgerAvailable ? 'allowed' : 'skipped_ledger_unavailable',
        outcome: err.kind,
        actualTokens: null
      })
      attemptIndex += 1
      // 全部 AiProviderError kind 均可切下一候选（长冷却由账本 reconcile 语义处理）
      continue
    }
  }

  if (!anyProviderCalled) {
    logWarn('ai_routing_quota_no_callable_candidates', {
      requestId: requestId ?? null,
      taskKind,
      lastFallbackReason: lastFallbackReason ?? null,
      message: 'quota 候选均被跳过，回落 resolveAiChatProvider 单路'
    })
    return deps.resolveProvider(env).complete(env, request)
  }

  if (lastError) {
    throw lastError
  }

  // 理论不可达：有调用却无错误
  throw new AiProviderError({
    kind: 'unknown',
    providerId: 'router',
    causeMessage: 'ai_routing_quota_exhausted_no_error'
  })
}

/**
 * background + 免费候选：日窗剩余比例须高于 BACKGROUND_FREE_TIER_DAILY_RESERVE_FLOOR。
 * 无日限额字段 → 不拦；无桶（从未用过）→ 视为剩余 1。
 */
async function isBlockedByBackgroundReserveFloor(
  ledger: QuotaLedgerPort,
  candidate: AiCandidateEntry,
  nowMs: number
): Promise<boolean> {
  const freeTier = candidate.freeTier
  if (!freeTier) return false
  try {
    const snap = await ledger.snapshot(candidate.candidateId, nowMs)
    const ratio =
      snap?.dailyRemainingRatio ??
      computeDailyRemainingRatio(snap?.dayWindow ?? { requestCount: 0, tokenEstimate: 0 }, freeTier)
    if (ratio === undefined) return false
    return ratio <= BACKGROUND_FREE_TIER_DAILY_RESERVE_FLOOR
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    logWarn('ai_quota_ledger_snapshot_failed', {
      candidateId: candidate.candidateId,
      detail
    })
    // 快照失败不拦（与账本故障降级一致）
    return false
  }
}

async function safeReserve(
  ledger: QuotaLedgerPort,
  candidateId: string,
  estimatedTokens: number,
  nowMs: number
): Promise<QuotaReserveResult> {
  try {
    return await ledger.reserve(candidateId, estimatedTokens, nowMs)
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    logWarn('ai_quota_ledger_reserve_failed', { candidateId, detail })
    return { allowed: true as const, reservationId: 'noop-after-error' }
  }
}

async function safeReconcile(
  ledger: QuotaLedgerPort,
  input: {
    candidateId: string
    reservationId: string
    actualTokens?: number
    outcome: QuotaReconcileOutcome
    nowMs: number
    retryAfterMs?: number
  }
): Promise<void> {
  try {
    await ledger.reconcile(
      input.candidateId,
      input.reservationId,
      input.actualTokens,
      input.outcome,
      input.nowMs,
      input.retryAfterMs
    )
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    logWarn('ai_quota_ledger_reconcile_failed', {
      candidateId: input.candidateId,
      outcome: input.outcome,
      detail
    })
  }
}

function sumDefined(a?: number, b?: number): number | undefined {
  if (a === undefined && b === undefined) return undefined
  return (a ?? 0) + (b ?? 0)
}
