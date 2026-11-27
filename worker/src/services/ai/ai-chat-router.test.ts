/**
 * 路由层：single 不触账本；shadow 仍走单 provider；quota 真实切换 + failover + kill switch。
 */

import { afterEach, describe, expect, test } from 'bun:test'
import { AI_CHAT_TASK_KINDS } from '../../config/ai-task-kind'
import type { Env } from '../../types/env'
import type { AiCandidateEntry } from './ai-candidate-registry'
import type {
  AiChatCompleteRequest,
  AiChatCompleteResult,
  AiChatProvider
} from './ai-chat-provider'
import {
  BACKGROUND_FREE_TIER_DAILY_RESERVE_FLOOR,
  estimateTokensForRequest,
  parseAiRoutingMode,
  resolveAiChatCompleter,
  routedComplete
} from './ai-chat-router'
import { AiProviderError } from './ai-provider-error'
import type { QuotaLedgerPort } from './quota-ledger-client'
import type { QuotaReconcileOutcome, QuotaReserveResult, QuotaSnapshot } from './quota-ledger-state'

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

describe('resolveAiChatCompleter / routedComplete · single / shadow', () => {
  test('single 模式不触账本与注册表，仍调单 provider', async () => {
    const completeCalls: AiChatCompleteRequest[] = []
    const ledger = trackingLedger()
    let listCalls = 0
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
      resolveLedger: () => ledger.port,
      listCandidates: () => {
        listCalls += 1
        return [paidCandidate('a')]
      }
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
    expect(listCalls).toBe(0)
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
        resolveLedger: () => ledger.port,
        listCandidates: () => [paidCandidate('deepseek-flash')]
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
          resolveLedger: () => ledger.port,
          listCandidates: () => [paidCandidate('deepseek-flash')]
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

describe('quota 模式 · 真实切换 / failover / 退化', () => {
  test('首选成功只调一次；无 fallbackReason', async () => {
    const calls: string[] = []
    const ledger = trackingLedger()
    const result = await routedComplete(
      env({ AI_ROUTING_MODE: 'quota' }),
      { prompt: 'hi', maxTokens: 10, taskKind: 'nlu', priority: 'interactive' },
      {
        resolveLedger: () => ledger.port,
        listCandidates: () => [paidCandidate('c1'), paidCandidate('c2')],
        resolveProviderForCandidate: () =>
          fakeProvider(async (_e, req) => {
            calls.push(req.model ?? '')
            return { text: 'ok', model: req.model ?? '', providerId: 'deepseek', tokensUsed: 5 }
          })
      }
    )
    expect(result.text).toBe('ok')
    expect(result.attempts).toBe(1)
    expect(result.fallbackReason).toBeUndefined()
    expect(calls).toEqual(['c1-model'])
    expect(ledger.reserves).toHaveLength(1)
    expect(ledger.reconciles).toHaveLength(1)
  })

  test('首选 429 rate_limit_minute 切第二候选成功；attempts=2、fallbackReason 正确', async () => {
    const calls: string[] = []
    const ledger = trackingLedger()
    const providers: Record<string, AiChatProvider> = {
      deepseek: fakeProvider(async (_e, req) => {
        calls.push(req.model ?? '')
        if (req.model === 'first-model') {
          throw new AiProviderError({
            kind: 'rate_limit_minute',
            providerId: 'deepseek',
            causeMessage: '429',
            retryAfterMs: 2000
          })
        }
        return { text: 'second-ok', model: req.model ?? '', providerId: 'deepseek', tokensUsed: 9 }
      })
    }

    const result = await routedComplete(
      env({ AI_ROUTING_MODE: 'quota' }),
      {
        prompt: 'hi',
        maxTokens: 10,
        taskKind: 'nlu',
        priority: 'interactive',
        requestId: 'req-failover'
      },
      {
        resolveLedger: () => ledger.port,
        listCandidates: () => [
          paidCandidate('first', { model: 'first-model' }),
          paidCandidate('second', { model: 'second-model' })
        ],
        resolveProviderForCandidate: id => providers[id]!
      }
    )

    expect(result.text).toBe('second-ok')
    expect(result.attempts).toBe(2)
    expect(result.fallbackReason).toBe('rate_limit_minute')
    expect(calls).toEqual(['first-model', 'second-model'])
    expect(ledger.reconciles.map(r => r.outcome)).toEqual(['rate_limit_minute', 'success'])
    expect(ledger.reconciles[0]?.retryAfterMs).toBe(2000)
  })

  test('首选日额度耗尽（quota_exhausted_daily）切下一候选', async () => {
    const ledger = trackingLedger()
    const result = await routedComplete(
      env({ AI_ROUTING_MODE: 'quota' }),
      { prompt: 'hi', maxTokens: 10, taskKind: 'nlu', priority: 'interactive' },
      {
        resolveLedger: () => ledger.port,
        listCandidates: () => [
          paidCandidate('a', { model: 'a-model' }),
          paidCandidate('b', { model: 'b-model' })
        ],
        resolveProviderForCandidate: () =>
          fakeProvider(async (_e, req) => {
            if (req.model === 'a-model') {
              throw new AiProviderError({
                kind: 'quota_exhausted_daily',
                providerId: 'deepseek',
                causeMessage: 'daily'
              })
            }
            return { text: 'ok', model: 'b-model', providerId: 'deepseek', tokensUsed: 3 }
          })
      }
    )
    expect(result.text).toBe('ok')
    expect(result.attempts).toBe(2)
    expect(result.fallbackReason).toBe('quota_exhausted_daily')
  })

  test('reserve 拒绝（minute_limit / daily_limit）跳过该候选', async () => {
    const calls: string[] = []
    const ledger = trackingLedger({
      reserveImpl: async candidateId => {
        if (candidateId === 'blocked-minute') {
          return { allowed: false, reason: 'minute_limit' }
        }
        if (candidateId === 'blocked-daily') {
          return { allowed: false, reason: 'daily_limit' }
        }
        return { allowed: true, reservationId: `res-${candidateId}` }
      }
    })

    const result = await routedComplete(
      env({ AI_ROUTING_MODE: 'quota' }),
      { prompt: 'hi', maxTokens: 10, taskKind: 'nlu', priority: 'interactive' },
      {
        resolveLedger: () => ledger.port,
        listCandidates: () => [
          paidCandidate('blocked-minute', { model: 'blocked-minute-model' }),
          paidCandidate('blocked-daily', { model: 'blocked-daily-model' }),
          paidCandidate('ok', { model: 'ok-model' })
        ],
        resolveProviderForCandidate: () =>
          fakeProvider(async (_e, req) => {
            calls.push(req.model ?? '')
            return { text: 'ok', model: req.model ?? '', providerId: 'deepseek', tokensUsed: 2 }
          })
      }
    )

    expect(result.text).toBe('ok')
    expect(calls).toEqual(['ok-model'])
    expect(result.attempts).toBe(1)
    expect(result.fallbackReason).toBe('daily_limit')
    expect(ledger.reserves.map(r => r.candidateId)).toEqual([
      'blocked-minute',
      'blocked-daily',
      'ok'
    ])
  })

  test('background 预留线拦截免费候选；interactive 放行', async () => {
    const free = freeCandidate('free-c', {
      freeTier: { rpd: 100, tpd: 10_000 },
      privacyTier: 'free_terms_ok'
    })
    const paid = paidCandidate('paid-c', { model: 'paid-model' })

    const lowRemainingLedger = trackingLedger({
      snapshotImpl: async () =>
        ({
          candidateId: 'free-c',
          minuteWindow: { requestCount: 0, tokenEstimate: 0, windowStartMs: 0 },
          dayWindow: { requestCount: 85, tokenEstimate: 0, resetAtMs: 1 },
          pendingCount: 0,
          // 15% < 20% 预留线
          dailyRemainingRatio: 0.15
        }) satisfies QuotaSnapshot
    })

    const bgCalls: string[] = []
    const bgResult = await routedComplete(
      env({ AI_ROUTING_MODE: 'quota' }),
      { prompt: 'bg', maxTokens: 10, taskKind: 'enrichment', priority: 'background' },
      {
        resolveLedger: () => lowRemainingLedger.port,
        listCandidates: () => [free, paid],
        resolveProviderForCandidate: () =>
          fakeProvider(async (_e, req) => {
            bgCalls.push(req.model ?? '')
            return { text: 'paid', model: req.model ?? '', providerId: 'deepseek', tokensUsed: 1 }
          })
      }
    )
    expect(bgResult.text).toBe('paid')
    expect(bgCalls).toEqual(['paid-model'])
    expect(bgResult.fallbackReason).toBe('background_reserve_floor')
    expect(BACKGROUND_FREE_TIER_DAILY_RESERVE_FLOOR).toBe(0.2)

    const interactiveCalls: string[] = []
    const interactiveLedger = trackingLedger({
      snapshotImpl: async () =>
        ({
          candidateId: 'free-c',
          minuteWindow: { requestCount: 0, tokenEstimate: 0, windowStartMs: 0 },
          dayWindow: { requestCount: 85, tokenEstimate: 0, resetAtMs: 1 },
          pendingCount: 0,
          dailyRemainingRatio: 0.15
        }) satisfies QuotaSnapshot
    })
    const interactiveResult = await routedComplete(
      env({ AI_ROUTING_MODE: 'quota' }),
      { prompt: 'fg', maxTokens: 10, taskKind: 'nlu', priority: 'interactive' },
      {
        resolveLedger: () => interactiveLedger.port,
        listCandidates: () => [free, paid],
        resolveProviderForCandidate: () =>
          fakeProvider(async (_e, req) => {
            interactiveCalls.push(req.model ?? '')
            return {
              text: 'free-ok',
              model: req.model ?? '',
              providerId: 'gateway-compat',
              tokensUsed: 1
            }
          })
      }
    )
    expect(interactiveResult.text).toBe('free-ok')
    expect(interactiveCalls[0]).toBe(free.model)
  })

  test('privacyTier=free_terms_unverified 即使 qualified 也不被选', async () => {
    const calls: string[] = []
    const ledger = trackingLedger()
    const unverified: AiCandidateEntry = {
      ...freeCandidate('unverified', { privacyTier: 'free_terms_unverified' }),
      qualifiedTaskKinds: [...AI_CHAT_TASK_KINDS],
      enabled: true
    }
    const result = await routedComplete(
      env({ AI_ROUTING_MODE: 'quota' }),
      { prompt: 'hi', maxTokens: 10, taskKind: 'nlu', priority: 'interactive' },
      {
        resolveLedger: () => ledger.port,
        listCandidates: () => [unverified, paidCandidate('safe', { model: 'safe-model' })],
        resolveProviderForCandidate: () =>
          fakeProvider(async (_e, req) => {
            calls.push(req.model ?? '')
            return { text: 'ok', model: req.model ?? '', providerId: 'deepseek', tokensUsed: 1 }
          })
      }
    )
    expect(calls).toEqual(['safe-model'])
    expect(result.fallbackReason).toBe('privacy_free_terms_unverified')
    expect(ledger.reserves.every(r => r.candidateId !== 'unverified')).toBe(true)
  })

  test('enabled=false 的候选不被 listRoutableCandidates 选出（注册表语义锁定）', async () => {
    const { listRoutableCandidates, AI_CANDIDATE_REGISTRY } =
      await import('./ai-candidate-registry')
    const disabled = AI_CANDIDATE_REGISTRY.filter(e => !e.enabled)
    expect(disabled.length).toBeGreaterThan(0)
    for (const kind of AI_CHAT_TASK_KINDS) {
      const routable = listRoutableCandidates(kind)
      for (const d of disabled) {
        expect(routable.map(r => r.candidateId)).not.toContain(d.candidateId)
      }
    }
  })

  test('全部失败抛最后错误', async () => {
    const ledger = trackingLedger()
    try {
      await routedComplete(
        env({ AI_ROUTING_MODE: 'quota' }),
        { prompt: 'hi', maxTokens: 10, taskKind: 'nlu', priority: 'interactive' },
        {
          resolveLedger: () => ledger.port,
          listCandidates: () => [
            paidCandidate('a', { model: 'a' }),
            paidCandidate('b', { model: 'b' })
          ],
          resolveProviderForCandidate: () =>
            fakeProvider(async (_e, req) => {
              throw new AiProviderError({
                kind: req.model === 'a' ? 'timeout' : 'upstream_5xx',
                providerId: 'deepseek',
                causeMessage: `fail-${req.model}`
              })
            })
        }
      )
      expect.unreachable()
    } catch (err) {
      expect(err).toBeInstanceOf(AiProviderError)
      expect((err as AiProviderError).kind).toBe('upstream_5xx')
      expect((err as AiProviderError).causeMessage).toBe('fail-b')
    }
  })

  test('账本抛错时降级仍成功（跳过 reserve）', async () => {
    let reserveCalls = 0
    const port: QuotaLedgerPort = {
      available: true,
      async reserve() {
        reserveCalls += 1
        throw new Error('ledger-down')
      },
      async reconcile() {
        /* no-op */
      },
      async snapshot() {
        return null
      }
    }

    const result = await routedComplete(
      env({ AI_ROUTING_MODE: 'quota' }),
      { prompt: 'hi', maxTokens: 10, taskKind: 'nlu', priority: 'interactive' },
      {
        resolveLedger: () => port,
        listCandidates: () => [paidCandidate('c1')],
        resolveProviderForCandidate: () =>
          fakeProvider(async () => ({
            text: 'degraded-ok',
            model: 'c1-model',
            providerId: 'deepseek',
            tokensUsed: 1
          }))
      }
    )
    expect(result.text).toBe('degraded-ok')
    expect(reserveCalls).toBe(1) // safeReserve 捕获后放行
  })

  test('账本 available=false 时跳过 reserve 仍成功', async () => {
    let reserveCalls = 0
    const port: QuotaLedgerPort = {
      available: false,
      async reserve() {
        reserveCalls += 1
        return { allowed: true, reservationId: 'should-not' }
      },
      async reconcile() {
        /* no-op */
      },
      async snapshot() {
        return null
      }
    }

    const result = await routedComplete(
      env({ AI_ROUTING_MODE: 'quota' }),
      { prompt: 'hi', maxTokens: 10, taskKind: 'nlu', priority: 'interactive' },
      {
        resolveLedger: () => port,
        listCandidates: () => [paidCandidate('c1')],
        resolveProviderForCandidate: () =>
          fakeProvider(async () => ({
            text: 'ok',
            model: 'c1-model',
            providerId: 'deepseek',
            tokensUsed: 1
          }))
      }
    )
    expect(result.text).toBe('ok')
    expect(reserveCalls).toBe(0)
  })

  test('候选为空回落单路', async () => {
    const fallbackCalls: AiChatCompleteRequest[] = []
    const ledger = trackingLedger()
    const result = await routedComplete(
      env({ AI_ROUTING_MODE: 'quota' }),
      { prompt: 'hi', maxTokens: 10, taskKind: 'nlu', priority: 'interactive' },
      {
        resolveProvider: () =>
          fakeProvider(async (_e, req) => {
            fallbackCalls.push(req)
            return { text: 'fallback', model: 'deepseek-flash', providerId: 'deepseek' }
          }),
        resolveLedger: () => ledger.port,
        listCandidates: () => []
      }
    )
    expect(result.text).toBe('fallback')
    expect(fallbackCalls).toHaveLength(1)
    expect(ledger.reserves).toHaveLength(0)
  })

  test('非 AiProviderError 不切换、原样上抛', async () => {
    const calls: string[] = []
    const ledger = trackingLedger()
    try {
      await routedComplete(
        env({ AI_ROUTING_MODE: 'quota' }),
        { prompt: 'hi', maxTokens: 10, taskKind: 'nlu', priority: 'interactive' },
        {
          resolveLedger: () => ledger.port,
          listCandidates: () => [
            paidCandidate('a', { model: 'a' }),
            paidCandidate('b', { model: 'b' })
          ],
          resolveProviderForCandidate: () =>
            fakeProvider(async (_e, req) => {
              calls.push(req.model ?? '')
              throw new Error('boom-not-provider')
            })
        }
      )
      expect.unreachable()
    } catch (err) {
      expect(err).toBeInstanceOf(Error)
      expect((err as Error).message).toBe('boom-not-provider')
    }
    expect(calls).toEqual(['a'])
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

function paidCandidate(id: string, overrides: Partial<AiCandidateEntry> = {}): AiCandidateEntry {
  return {
    candidateId: id,
    providerId: 'deepseek',
    model: overrides.model ?? `${id}-model`,
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
    model: overrides.model ?? `${id}-model`,
    apiKeyEnv: 'GROQ_API_KEY',
    freeTier: { rpm: 30, rpd: 100 },
    privacyTier: 'free_terms_ok',
    qualifiedTaskKinds: [...AI_CHAT_TASK_KINDS],
    evalNote: 'test',
    enabled: true,
    ...overrides
  }
}

function trackingLedger(options?: {
  reserveImpl?: (candidateId: string, estimatedTokens: number) => Promise<QuotaReserveResult>
  snapshotImpl?: (candidateId: string, nowMs: number) => Promise<QuotaSnapshot | null>
}): {
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
    available: true,
    async reserve(candidateId, estimatedTokens): Promise<QuotaReserveResult> {
      reserves.push({ candidateId, estimatedTokens })
      if (options?.reserveImpl) {
        return options.reserveImpl(candidateId, estimatedTokens)
      }
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
    async snapshot(candidateId, nowMs) {
      if (options?.snapshotImpl) {
        return options.snapshotImpl(candidateId, nowMs)
      }
      return null
    }
  }
  return { port, reserves, reconciles }
}
