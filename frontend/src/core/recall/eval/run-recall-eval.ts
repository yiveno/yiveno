import { RECALL_RESULT_SLOT_LIMIT } from '@/core/recall/build-recall-result'
import type { RecallEvalCase } from '@/core/recall/eval/recall-eval-cases'
import { buildRecallEvalCorpus } from '@/core/recall/eval/recall-eval-corpus'
import { RECALL_EVAL_NOW_MS } from '@/core/recall/eval/recall-eval-now'
import type { MemoryItem } from '@/core/memory/memory-item'
import {
  excludeDismissedMemoryItems,
  mergeDialogUtterances
} from '@/core/recall/merge-recall-dialog-turn'
import { recallByKeywordWithParsedClue } from '@/core/recall/orchestrate-keyword-recall'
import type { ParsedRecallClue } from '@/core/recall/parse-recall-clue-types'
import type { RecallResult } from '@/core/recall/recall-result'

/** 单条用例结果。 */
export interface RecallEvalCaseResult {
  caseId: string
  gate: RecallEvalCase['gate']
  clue: string
  passed: boolean
  detail: string
  result: RecallResult
}

/** 汇总指标。 */
export interface RecallEvalReport {
  must: { total: number; passed: number; failed: RecallEvalCaseResult[] }
  stretch: { total: number; passed: number; failed: RecallEvalCaseResult[] }
  cases: RecallEvalCaseResult[]
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

/** 判定单条期望是否满足。 */
export function judgeRecallEvalCase(
  evalCase: RecallEvalCase,
  result: RecallResult
): { passed: boolean; detail: string } {
  const { expectation } = evalCase

  if (expectation.kind === 'no_match') {
    const passed = result.outcome === 'no_match' && result.topPick === null
    return {
      passed,
      detail: passed
        ? '正确 no_match'
        : `期望 no_match，实际 outcome=${result.outcome} topPick=${result.topPick?.item.id ?? 'null'}`
    }
  }

  if (expectation.kind === 'need_a_clue') {
    const ids = candidateIds(result, RECALL_RESULT_SLOT_LIMIT)
    const passed =
      result.outcome === 'need_a_clue' &&
      result.topPick === null &&
      ids.includes(expectation.expectedId)
    return {
      passed,
      detail: passed
        ? 'need_a_clue 且弱候选含期望项'
        : `期望 need_a_clue 含 ${expectation.expectedId}，实际 outcome=${result.outcome} topPick=${result.topPick?.item.id ?? 'null'} candidates=[${ids.join(', ') || '空'}]`
    }
  }

  if (expectation.kind === 'top1') {
    const actualId = result.topPick?.item.id
    const passed = result.outcome === 'top_pick' && actualId === expectation.expectedId
    return {
      passed,
      detail: passed
        ? 'Top1 命中'
        : `期望 Top1=${expectation.expectedId}，实际=${actualId ?? 'null'} (outcome=${result.outcome})`
    }
  }

  const k = expectation.k ?? 6
  const ids = candidateIds(result, k)
  const passed = ids.includes(expectation.expectedId)
  return {
    passed,
    detail: passed
      ? `in_top${k} 命中`
      : `期望 ${expectation.expectedId} 进入前 ${k}，实际=[${ids.join(', ') || '空'}]`
  }
}

/** 多轮：逐轮规则 parse 后槽位 merge，得到最终 ParsedRecallClue。 */
export function parseDialogTurnsToMerged(
  turns: readonly string[],
  nowMs: number
): { currentClue: string; merged: ParsedRecallClue; effectiveRaw: string } {
  if (turns.length === 0) {
    return {
      currentClue: '',
      merged: {
        raw: '',
        contentTerms: [],
        confidence: 'low'
      },
      effectiveRaw: ''
    }
  }

  const { merged, effectiveRaw } = mergeDialogUtterances(turns, { nowMs })
  return {
    currentClue: turns[turns.length - 1]!.trim(),
    merged: merged!,
    effectiveRaw
  }
}

/**
 * 对线索集跑一轮 Recall eval（对齐线上主路径：口语解析 + 可选多轮 merge + 关键词 Filter）。
 * @param cases 用例；默认由调用方传入 RECALL_EVAL_CASES
 * @param corpus 记忆库；默认 buildRecallEvalCorpus()
 */
export function runRecallEval(
  cases: RecallEvalCase[],
  corpus: MemoryItem[] = buildRecallEvalCorpus()
): RecallEvalReport {
  const caseResults: RecallEvalCaseResult[] = cases.map(evalCase => {
    const turns =
      evalCase.dialogTurns && evalCase.dialogTurns.length > 0
        ? evalCase.dialogTurns
        : [evalCase.clue]
    const { currentClue, merged, effectiveRaw } = parseDialogTurnsToMerged(
      turns,
      RECALL_EVAL_NOW_MS
    )
    const items = excludeDismissedMemoryItems(corpus, evalCase.dismissedIds)
    const result = attachEvalMeta(
      recallByKeywordWithParsedClue(items, currentClue, {
        nowMs: RECALL_EVAL_NOW_MS,
        parsed: merged
      }),
      { parsed: merged, effectiveClue: effectiveRaw, clue: currentClue }
    )
    const judged = judgeRecallEvalCase(evalCase, result)
    return {
      caseId: evalCase.id,
      gate: evalCase.gate,
      clue: evalCase.clue,
      passed: judged.passed,
      detail: judged.detail,
      result
    }
  })

  const mustCases = caseResults.filter(item => item.gate === 'must')
  const stretchCases = caseResults.filter(item => item.gate === 'stretch')

  return {
    must: {
      total: mustCases.length,
      passed: mustCases.filter(item => item.passed).length,
      failed: mustCases.filter(item => !item.passed)
    },
    stretch: {
      total: stretchCases.length,
      passed: stretchCases.filter(item => item.passed).length,
      failed: stretchCases.filter(item => !item.passed)
    },
    cases: caseResults
  }
}

function attachEvalMeta(
  result: RecallResult,
  meta: { parsed: ParsedRecallClue; effectiveClue: string; clue: string }
): RecallResult {
  return {
    ...result,
    clue: meta.clue,
    parsed: meta.parsed,
    effectiveClue: meta.effectiveClue
  }
}
