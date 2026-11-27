/**
 * 路由层：single 不触账本；shadow 仍走单 provider + 决策日志 + reserve/reconcile。
 */

import { afterEach, describe, expect, test } from 'bun:test'
import type { Env } from '../../types/env'
import type {
  AiChatCompleteRequest,
  AiChatCompleteResult,
  AiChatProvider
} from './ai-chat-provider'
import {
  estimateTokensForRequest,
  parseAiRoutingMode,
  resolveAiChatCompleter,
  routedComplete
} from './ai-chat-router'
import { AiProviderError } from './ai-provider-error'
import type { QuotaLedgerPort } from './quota-ledger-client'
import type { QuotaReconcileOutcome, QuotaReserveResult } from './quota-ledger-state'

const originalConsoleWarn = console.warn

function env(overrides: Record<string, unknown> = {}): Env {
  return {
    AI_PROVIDER: 'deepseek',
    DEEPSEEK_API_KEY: 'sk-test',
    AI_HOSTED_MODEL: 'deepseek-flash',
    ...overrides
  } as unknown as Env
}

afterEach(() => {
  console.warn = originalConsoleWarn
})

describe('parseAiRoutingMode / estimateTokensForRequest', () => {
  test('缺省与 single → single；未知抛 misconfigured', () => {
    expect(parseAiRoutingMode(undefined)).toBe('single')
    expect(parseAiRoutingMode('')).toBe('single')
    expect(parseAiRoutingMode('single')).toBe('single')
    expect(parseAiRoutingMode('shadow')).toBe('shadow')
    expect(parseAiRoutingMode('quota')).toBe('quota')
    try {
      parseAiRoutingMode('weird')
      expect.unreachable()
    } catch (err) {
      expect(err).toBeInstanceOf(AiProviderError)
      expect((err as AiProviderError).kind).toBe('misconfigured')
    }
  })

  test('token 估算 = ceil(chars/4) + maxTokens', () => {
    expect(estimateTokensForRequest({ prompt: 'abcdefgh', maxTokens: 10 })).toBe(12)
    expect(
      estimateTokensForRequest({
        messages: [
          { role: 'system', content: 'abcd' },
          { role: 'user', content: 'efgh' }
        ],
        maxTokens: 5
      })
    ).toBe(7)
  })
})

describe('resolveAiChatCompleter / routedComplete', () => {
  test('single 模式不触账本，仍调单 provider', async () => {
    const completeCalls: AiChatCompleteRequest[] = []
    const ledger = trackingLedger()
    const provider = fakeProvider(async (_env, request) => {
      completeCalls.push(request)
      return {
        text: 'ok',
        model: 'deepseek-flash',
        providerId: 'deepseek',
        tokensUsed: 11
      }
    })

    const result = await resolveAiChatCompleter(env({ AI_ROUTING_MODE: 'single' }), {
      resolveProvider: () => provider,
      resolveLedger: () => ledger.port
    }).complete(env({ AI_ROUTING_MODE: 'single' }), {
      prompt: 'hello',
      maxTokens: 20,
      taskKind: 'nlu',
      priority: 'interactive'
    })

    expect(result.text).toBe('ok')
    expect(completeCalls).toHaveLength(1)
    expect(ledger.reserves).toHaveLength(0)
    expect(ledger.reconciles).toHaveLength(0)
  })

  test('shadow：实际仍单 provider；决策日志字段齐全；reserve/reconcile 被调用', async () => {
    const completeCalls: AiChatCompleteRequest[] = []
    const decisionLogs: Record<string, unknown>[] = []
    const ledger = trackingLedger()
    const prevTestLogs = process.env.WORKER_TEST_LOGS
    process.env.WORKER_TEST_LOGS = '1'

    console.warn = ((message?: unknown) => {
      if (typeof message !== 'string') return
      try {
        const parsed = JSON.parse(message) as { message?: string; [k: string]: unknown }
        if (parsed.message === 'ai_routing_decision') {
          decisionLogs.push(parsed)
        }
      } catch {
        /* ignore */
      }
    }) as typeof console.warn

    const provider = fakeProvider(async (_env, request) => {
      completeCalls.push(request)
      return {
        text: 'shadow-ok',
        model: 'deepseek-flash',
        providerId: 'deepseek',
        tokensUsed: 42,
        promptTokens: 20,
        completionTokens: 22
      }
    })

    const e = env({ AI_ROUTING_MODE: 'shadow' })
    const result = await routedComplete(
      e,
      {
        prompt: 'find my note',
        maxTokens: 30,
        taskKind: 'nlu',
        priority: 'interactive',
        requestId: 'req-shadow-1'
      },
      {
        resolveProvider: () => provider,
        resolveLedger: () => ledger.port
      }
    )

    expect(result.text).toBe('shadow-ok')
    expect(result.attempts).toBe(1)
    expect(result.providerId).toBe('deepseek')
    expect(completeCalls).toHaveLength(1)
    expect(ledger.reserves).toHaveLength(1)
    expect(ledger.reserves[0]?.candidateId).toBe('deepseek-flash')
    expect(ledger.reconciles).toHaveLength(1)
    expect(ledger.reconciles[0]?.outcome).toBe('success')
    expect(ledger.reconciles[0]?.actualTokens).toBe(42)

    expect(decisionLogs.length).toBeGreaterThanOrEqual(1)
    const decision = decisionLogs[0]!
    expect(decision.requestId).toBe('req-shadow-1')
    expect(decision.taskKind).toBe('nlu')
    expect(decision.chosenCandidateId).toBe('deepseek-flash')
    expect(decision.mode).toBe('shadow')
    expect(decision.reserveAllowed).toBe(true)
    expect(Object.prototype.hasOwnProperty.call(decision, 'prompt')).toBe(false)

    if (prevTestLogs === undefined) {
      delete process.env.WORKER_TEST_LOGS
    } else {
      process.env.WORKER_TEST_LOGS = prevTestLogs
    }
  })

  test('shadow：AiProviderError 上抛时 reconcile 收到正确 kind', async () => {
    const ledger = trackingLedger()
    const provider = fakeProvider(async () => {
      throw new AiProviderError({
        kind: 'rate_limit_minute',
        providerId: 'deepseek',
        causeMessage: '429',
        retryAfterMs: 1500
      })
    })

    const e = env({ AI_ROUTING_MODE: 'shadow' })
    try {
      await routedComplete(
        e,
        {
          prompt: 'x',
          maxTokens: 10,
          taskKind: 'enrichment',
          priority: 'background'
        },
        {
          resolveProvider: () => provider,
          resolveLedger: () => ledger.port
        }
      )
      expect.unreachable()
    } catch (err) {
      expect(err).toBeInstanceOf(AiProviderError)
      expect((err as AiProviderError).kind).toBe('rate_limit_minute')
    }

    expect(ledger.reserves).toHaveLength(1)
    expect(ledger.reconciles).toHaveLength(1)
    expect(ledger.reconciles[0]?.outcome).toBe('rate_limit_minute')
    expect(ledger.reconciles[0]?.retryAfterMs).toBe(1500)
  })
})

function fakeProvider(
  complete: (env: Env, request: AiChatCompleteRequest) => Promise<AiChatCompleteResult>
): AiChatProvider {
  return {
    id: 'deepseek',
    isConfigured: () => true,
    complete
  }
}

function trackingLedger(): {
  port: QuotaLedgerPort
  reserves: Array<{ candidateId: string; estimatedTokens: number }>
  reconciles: Array<{
    candidateId: string
    reservationId: string
    actualTokens: number | undefined
    outcome: QuotaReconcileOutcome
    retryAfterMs?: number
  }>
} {
  const reserves: Array<{ candidateId: string; estimatedTokens: number }> = []
  const reconciles: Array<{
    candidateId: string
    reservationId: string
    actualTokens: number | undefined
    outcome: QuotaReconcileOutcome
    retryAfterMs?: number
  }> = []

  let seq = 0
  const port: QuotaLedgerPort = {
    async reserve(candidateId, estimatedTokens): Promise<QuotaReserveResult> {
      reserves.push({ candidateId, estimatedTokens })
      seq += 1
      return { allowed: true, reservationId: `res-${seq}` }
    },
    async reconcile(candidateId, reservationId, actualTokens, outcome, _nowMs, retryAfterMs) {
      reconciles.push({
        candidateId,
        reservationId,
        actualTokens,
        outcome,
        ...(retryAfterMs !== undefined ? { retryAfterMs } : {})
      })
    },
    async snapshot() {
      return null
    }
  }
  return { port, reserves, reconciles }
}
