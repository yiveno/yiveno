/**
 * Hybrid eval 跑腿。
 *
 * 复用 `fuseHybridMatches`（Hybrid path 的纯函数核心），不调用 `HybridRecallBackend.recallWithClue`
 *（避免触发 `getAuthSession` / chrome.storage 副作用）；embedding 请求由调用方在 vitest 用
 * `vi.mock('@/infrastructure/ai/embed-api-client')` 替身。
 *
 * R0 / 关键词领先者保护 / 佐证门 / ADR-011 时间筛由 `fuseHybridMatches` 自身承担；
 * 关键词主路径保留为对比基线（用于 R0 助手发令的对照与 dbg-info）。
 */

import { fuseHybridMatches } from '@/application/recall/backends/hybrid-recall-backend'
import { RECALL_RESULT_PAGE_SIZE } from '@/core/recall/build-recall-result'
import { buildHybridEvalCorpus, HYBRID_EVAL_NOW_MS } from '@/core/recall/eval/hybrid-eval-corpus'
import type { HybridEvalCase } from '@/core/recall/eval/hybrid-eval-cases'
import {
  observeEvalFailure,
  type EvalFailureObservation
} from '@/core/recall/eval/eval-failure-observation'
import { excludeDismissedMemoryItems } from '@/core/recall/merge-recall-dialog-turn'
import { parseRecallClue } from '@/core/recall/parse-recall-clue'
import type { RecallResult } from '@/core/recall/recall-result'
import type { MemoryItem } from '@/core/memory/memory-item'
import type { ParsedRecallClue } from '@/core/recall/parse-recall-clue-types'
import { shouldSkipRecallAsZeroAnchor } from '@/core/recall/orchestrate-keyword-recall'

export interface HybridEvalCaseResult {
  caseId: string
  gate: HybridEvalCase['gate']
  clue: string
  passed: boolean
  detail: string
  result: RecallResult | null
  /** 是否真正跑到 Hybrid 融合（vs 关键词降级 / null 跳过） */
  hybridUsed: boolean
  /**
   * 失败时的阶段观察（非根因）。
   * 通过用例为 not_applicable；**不**改变 must 判定。
   */
  failureObservation: EvalFailureObservation
}

export interface HybridEvalReport {
  must: { total: number; passed: number; failed: HybridEvalCaseResult[] }
  stretch: { total: number; passed: number; failed: HybridEvalCaseResult[] }
  cases: HybridEvalCaseResult[]
}

function candidateIds(result: RecallResult, k: number): string[] {
  const ids: string[] = []
  if (result.topPick) {
    ids.push(result.topPick.item.id)
  }
  for (const match of result.alsoPossible) {
    ids.push(match.item.id)
  }
  return ids.slice(0, k)
}

/** 单条期望判定（与 `judgeRecallEvalCase` 同形态，仅复用 top1/in_topk/no_match）。 */
function judgeHybridEvalCase(
  evalCase: HybridEvalCase,
  result: RecallResult | null
): { passed: boolean; detail: string } {
  const { expectation } = evalCase

  if (!result || expectation.kind === 'no_match') {
    const passed = result !== null && result.outcome === 'no_match' && result.topPick === null
    return {
      passed,
      detail: passed
        ? '正确 no_match'
        : `期望 no_match，实际 ${result ? `outcome=${result.outcome} topPick=${result.topPick?.item.id ?? 'null'}` : 'result=null'}`
    }
  }

  if (expectation.kind === 'top1') {
    const actualId = result.topPick?.item.id
    const passed = result.outcome === 'top_pick' && actualId === expectation.expectedId
    return {
      passed,
      detail: passed
        ? 'Hybrid Top1 命中'
        : `期望 Top1=${expectation.expectedId}，实际=${actualId ?? 'null'} (outcome=${result.outcome})`
    }
  }

  const k = expectation.k ?? RECALL_RESULT_PAGE_SIZE
  const ids = candidateIds(result, k)
  const passed = ids.includes(expectation.expectedId)
  return {
    passed,
    detail: passed
      ? `in_top${k} 命中`
      : `期望 ${expectation.expectedId} 进入前 ${k}，实际=[${ids.join(', ') || '空'}]`
  }
}

/**
 * 走一遍 Hybrid 路径（mock embed 替身后）。
 */
async function runHybridPath(
  clue: string,
  parsed: ParsedRecallClue,
  items: MemoryItem[],
  currentTabDomain: string | undefined,
  pairClue: string,
  embeddingAnchor: string | undefined
): Promise<{ result: RecallResult | null; hybridUsed: boolean }> {
  // 复刻 `HybridRecallBackend.recallWithClue` 的 R0/约束邻域闸：
  // 零锚点助手发令 / 非 Recall 助手 → 诚实 no_match，禁止把语义近邻填空。
  if (shouldSkipRecallAsZeroAnchor(clue, parsed)) {
    return {
      result: {
        outcome: 'no_match',
        topPick: null,
        alsoPossible: [],
        totalRankedCount: 0,
        clue
      },
      hybridUsed: false
    }
  }

  const filterClue = parsed.contentTerms.join(' ').trim() || parsed.raw
  // 用 `embeddingAnchor` 拼 embedding 文本；fake embedding 据此与目标 item 余弦恒为 1。
  // 无 anchor 时回退到原始 clue 文本（仍可能命中，但不稳定；仅用于 R0 之外的边缘 case）。
  const clueEmbeddingText = embeddingAnchor ?? pairClue

  // 模拟主入口的 `trace` 注入：测试不连真实 SW 流，用 noop trace。
  const noopTrace = () => {}

  const fused = await fuseHybridMatches({
    displayClue: clue,
    pairClue,
    items,
    filterClue,
    parsed,
    clueEmbeddingText,
    // eval 夹具显式带 currentTabDomain 时按 boost 验同域加成（生产默认 none）
    ...(currentTabDomain ? { currentTabDomain, pageContextMode: 'boost' as const } : {}),
    trace: noopTrace
  })

  if (fused) {
    return { result: fused.result, hybridUsed: true }
  }
  return { result: null, hybridUsed: false }
}

/**
 * 主入口：跑 Hybrid eval 一轮（同 `runRecallEval` 的报告形态，必须区分 must / stretch）。
 *
 * 默认 corpus = `buildHybridEvalCorpus()`；测试可注入。
 */
export async function runHybridEval(
  cases: HybridEvalCase[],
  corpus: MemoryItem[] = buildHybridEvalCorpus()
): Promise<HybridEvalReport> {
  const caseResults: HybridEvalCaseResult[] = []

  for (const evalCase of cases) {
    const trimmed = evalCase.clue.trim()
    const parsed = parseRecallClue(trimmed, { nowMs: HYBRID_EVAL_NOW_MS })
    const items = excludeDismissedMemoryItems(corpus, evalCase.dismissedIds as readonly string[])

    const { result, hybridUsed } = await runHybridPath(
      trimmed,
      parsed,
      items,
      evalCase.currentTabDomain,
      trimmed,
      evalCase.embeddingAnchor
    )

    const judged = judgeHybridEvalCase(evalCase, result)
    const expectation = evalCase.expectation
    const failureObservation = observeEvalFailure({
      passed: judged.passed,
      expectationKind: expectation.kind,
      ...(expectation.kind !== 'no_match' ? { expectedId: expectation.expectedId } : {}),
      result,
      goldInLibrary: true
    })
    caseResults.push({
      caseId: evalCase.id,
      gate: evalCase.gate,
      clue: evalCase.clue,
      passed: judged.passed,
      detail: judged.detail,
      result,
      hybridUsed,
      failureObservation
    })
  }

  const must = caseResults.filter(item => item.gate === 'must')
  const stretch = caseResults.filter(item => item.gate === 'stretch')

  return {
    must: {
      total: must.length,
      passed: must.filter(item => item.passed).length,
      failed: must.filter(item => !item.passed)
    },
    stretch: {
      total: stretch.length,
      passed: stretch.filter(item => item.passed).length,
      failed: stretch.filter(item => !item.passed)
    },
    cases: caseResults
  }
}
