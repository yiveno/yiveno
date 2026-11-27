/**
 * Runner：逐条喂 clue → 抓解析输出 / 耗时 / 报错；失败重试、超时跳过。
 * 纯编排；理解函数由调用方注入（产品 `understandRecallClue` 或测试 stub）。
 */

import { resolveRecallTopic } from '@/core/recall/recall-topic'
import type { UnderstandRecallClueResult } from '@/core/recall/understand/understand-recall-clue'
import type { ClueChainCase, ClueChainParseRunCase } from './types'

export type ClueChainUnderstandFn = (
  clue: string,
  options: { nowMs: number }
) => Promise<UnderstandRecallClueResult>

export interface RunClueChainParseCaseOptions {
  understand: ClueChainUnderstandFn
  nowMs: number
  /** 含首次在内的最大尝试次数（默认 2 = 失败再试 1 次）。 */
  maxAttempts?: number
  /** 单次尝试超时毫秒（默认 60s）。 */
  timeoutMs?: number
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`timeout after ${timeoutMs}ms (${label})`))
    }, timeoutMs)
    promise.then(
      value => {
        clearTimeout(timer)
        resolve(value)
      },
      error => {
        clearTimeout(timer)
        reject(error)
      }
    )
  })
}

function emptyRun(
  item: ClueChainCase,
  patch: Partial<ClueChainParseRunCase>
): ClueChainParseRunCase {
  return {
    id: item.id,
    category: item.category,
    clue: item.clue,
    note: item.note,
    difficulty: item.difficulty,
    expected: item.expected,
    parsed: null,
    source: null,
    intentActual: null,
    topicTermsActual: [],
    timeLabelActual: null,
    timeConfidenceActual: null,
    objectTypesActual: [],
    objectTypeOtherActual: null,
    contentTermsActual: [],
    excludeContentTermsActual: [],
    confidenceActual: null,
    durationMs: 0,
    attempts: 0,
    error: null,
    timedOut: false,
    skipped: false,
    ...patch
  }
}

/** 跑单条；超时耗尽重试后标记 timedOut+skipped。 */
export async function runClueChainParseCase(
  item: ClueChainCase,
  options: RunClueChainParseCaseOptions
): Promise<ClueChainParseRunCase> {
  const maxAttempts = options.maxAttempts ?? 2
  const timeoutMs = options.timeoutMs ?? 60_000
  const started = Date.now()
  let lastError: string | null = null
  let timedOut = false

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const understood = await withTimeout(
        options.understand(item.clue, { nowMs: options.nowMs }),
        timeoutMs,
        item.id
      )
      const parsed = understood.parsed
      // 理解层常不写 parsed.topic；与产品下游一致，用 resolveRecallTopic 派生
      const topicTerms = resolveRecallTopic(parsed)?.terms ?? parsed.contentTerms ?? []
      return emptyRun(item, {
        parsed,
        source: understood.source,
        intentActual: parsed.intent ?? 'recall',
        topicTermsActual: topicTerms,
        timeLabelActual: parsed.timeRange?.label ?? null,
        timeConfidenceActual: parsed.timeConfidence ?? null,
        objectTypesActual: parsed.objectTypes ?? [],
        objectTypeOtherActual: parsed.objectTypeOther ?? null,
        contentTermsActual: parsed.contentTerms ?? [],
        excludeContentTermsActual: parsed.excludeContentTerms ?? [],
        confidenceActual: parsed.confidence,
        durationMs: Date.now() - started,
        attempts: attempt,
        error: null,
        timedOut: false,
        skipped: false
      })
    } catch (error) {
      // 日配额耗尽等不可恢复错误：上抛给 batch / CLI，便于 checkpoint 后停跑
      if (error instanceof Error && error.name === 'DailyQuotaExhaustedError') {
        throw error
      }
      const message = error instanceof Error ? error.message : String(error)
      lastError = message
      if (message.startsWith('timeout after')) {
        timedOut = true
      }
    }
  }

  return emptyRun(item, {
    durationMs: Date.now() - started,
    attempts: maxAttempts,
    error: lastError,
    timedOut,
    skipped: timedOut
  })
}

export interface RunClueChainParseBatchOptions extends RunClueChainParseCaseOptions {
  cases: readonly ClueChainCase[]
  /** 已完成 id → 结果；用于断点续跑。 */
  checkpoint?: ReadonlyMap<string, ClueChainParseRunCase>
  onCaseDone?: (result: ClueChainParseRunCase, index: number, total: number) => void
}

/** 批量跑；checkpoint 命中则跳过重跑。 */
export async function runClueChainParseBatch(
  options: RunClueChainParseBatchOptions
): Promise<ClueChainParseRunCase[]> {
  const out: ClueChainParseRunCase[] = []
  const total = options.cases.length
  for (let index = 0; index < total; index += 1) {
    const item = options.cases[index]!
    const cached = options.checkpoint?.get(item.id)
    if (cached) {
      out.push(cached)
      options.onCaseDone?.(cached, index, total)
      continue
    }
    const result = await runClueChainParseCase(item, options)
    out.push(result)
    options.onCaseDone?.(result, index, total)
  }
  return out
}
