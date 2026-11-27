/**
 * AI chat 路由层（Batch 2）：single / shadow / quota 模式。
 *
 * - single（缺省）：与现行 resolveAiChatProvider.complete 逐字一致，不触账本。
 * - shadow：查候选 → reserve → 记决策日志 → 仍走现行单 provider；成功/失败 reconcile。
 * - quota：本批仅枚举 + TODO；行为等同 shadow 并 warn（下一批真实切换）。
 *
 * 不切换生产流量：默认 AI_ROUTING_MODE 缺省 = single。
 */

import { AI_CHAT_TASK_KIND_DEFAULT, type AiChatTaskKind } from '../../config/ai-task-kind'
import type { Env } from '../../types/env'
import { info as logInfo, warn as logWarn } from '../../utils/logger'
import { listRoutableCandidates } from './ai-candidate-registry'
import {
  resolveAiChatProvider,
  type AiChatCompleteRequest,
  type AiChatCompleteResult,
  type AiChatProvider,
  type AiChatRequestPriority
} from './ai-chat-provider'
import { AiProviderError } from './ai-provider-error'
import { resolveQuotaLedger, type QuotaLedgerPort } from './quota-ledger-client'
import type { QuotaReconcileOutcome } from './quota-ledger-state'

/** 路由模式。 */
export type AiRoutingMode = 'single' | 'shadow' | 'quota'

/** 带路由的补全入口。 */
export type AiChatCompleter = {
  complete(env: Env, request: AiChatCompleteRequest): Promise<AiChatCompleteResult>
}

/** 可注入依赖（单测用）。 */
export type AiChatRouterDeps = {
  resolveProvider?: (env: Env) => AiChatProvider
  resolveLedger?: (env: Env) => QuotaLedgerPort
  nowMs?: () => number
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

  if (mode === 'single') {
    return resolveProvider(env).complete(env, request)
  }

  if (mode === 'quota') {
    // TODO(Batch 3+)：按候选真实切换 provider / model；本批行为等同 shadow。
    logWarn('ai_routing_quota_mode_deferred', {
      message: 'AI_ROUTING_MODE=quota 本批未实现真实切换，行为等同 shadow'
    })
  }

  return shadowComplete(env, request, mode, {
    resolveProvider,
    resolveLedger: deps?.resolveLedger ?? resolveQuotaLedger,
    nowMs: deps?.nowMs ?? Date.now
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
  }
): Promise<AiChatCompleteResult> {
  const taskKind = resolveTaskKind(request)
  const priority = resolvePriority(request)
  const requestId = request.requestId
  const candidates = listRoutableCandidates(taskKind)
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

async function safeReserve(
  ledger: QuotaLedgerPort,
  candidateId: string,
  estimatedTokens: number,
  nowMs: number
) {
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
