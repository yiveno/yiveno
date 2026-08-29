import type { RecallEvalCaseResult } from '@/core/recall/eval/run-recall-eval'
import { judgeRecallEvalCase } from '@/core/recall/eval/run-recall-eval'
import { buildRecallEvalCorpus } from '@/core/recall/eval/recall-eval-corpus'
import { RECALL_EVAL_NOW_MS } from '@/core/recall/eval/recall-eval-now'
import type { OmniboxEvalCase } from '@/core/recall/eval/omnibox-eval-cases'
import { toRecallEvalMustCase } from '@/core/recall/eval/omnibox-eval-cases'
import type { MemoryItem } from '@/core/memory/memory-item'
import { excludeDismissedMemoryItems } from '@/core/recall/merge-recall-dialog-turn'
import {
  recallByKeywordWithParsedClue,
  shouldSkipRecallAsZeroAnchor
} from '@/core/recall/orchestrate-keyword-recall'
import type { RecallResult } from '@/core/recall/recall-result'
import { understandRecallClue } from '@/core/recall/understand/understand-recall-clue'

/** Omnibox 单条 eval 结果（含理解层来源）。 */
export interface OmniboxEvalCaseResult extends RecallEvalCaseResult {
  understandSource: string
}

export interface OmniboxEvalReport {
  must: { total: number; passed: number; failed: OmniboxEvalCaseResult[] }
  cases: OmniboxEvalCaseResult[]
}

function emptyNoMatch(clue: string): RecallResult {
  return {
    outcome: 'no_match',
    topPick: null,
    alsoPossible: [],
    totalRankedCount: 0,
    clue
  }
}

/**
 * 跑 Omnibox 离线快跳轨 eval（对齐 ADR-007）：
 * - `understandRecallClue` + `forceMode: lexical`（无 LLM completer）
 * - 单轮、无 context / framing
 * - 关键词 Filter（与 `run-recall-eval` 同 corpus）
 */
export async function runOmniboxEval(
  cases: OmniboxEvalCase[],
  corpus: MemoryItem[] = buildRecallEvalCorpus()
): Promise<OmniboxEvalReport> {
  const caseResults: OmniboxEvalCaseResult[] = []

  for (const evalCase of cases) {
    const clue = evalCase.clue.trim()
    const understood = await understandRecallClue(clue, {
      forceMode: 'lexical',
      nowMs: RECALL_EVAL_NOW_MS
    })

    let result: RecallResult
    if (understood.disposition === 'reject_noise') {
      result = emptyNoMatch(clue)
    } else if (shouldSkipRecallAsZeroAnchor(clue, understood.parsed)) {
      result = emptyNoMatch(clue)
    } else {
      const items = excludeDismissedMemoryItems(corpus)
      result = recallByKeywordWithParsedClue(items, clue, {
        nowMs: RECALL_EVAL_NOW_MS,
        parsed: understood.parsed
      })
      result = {
        ...result,
        clue,
        parsed: understood.parsed,
        effectiveClue: understood.filterClue
      }
    }

    const judged = judgeRecallEvalCase(toRecallEvalMustCase(evalCase), result)
    caseResults.push({
      caseId: evalCase.id,
      gate: 'must',
      clue: evalCase.clue,
      passed: judged.passed,
      detail: judged.detail,
      result,
      understandSource: understood.source
    })
  }

  const passed = caseResults.filter(item => item.passed).length
  return {
    must: {
      total: caseResults.length,
      passed,
      failed: caseResults.filter(item => !item.passed)
    },
    cases: caseResults
  }
}

/** 门禁：Omnibox proceed 用例理解来源须为 rules（非 LLM）。 */
export function assertOmniboxUnderstandSourceRules(
  cases: OmniboxEvalCase[],
  report: OmniboxEvalReport
): string[] {
  const byId = new Map(cases.map(item => [item.id, item]))
  const violations: string[] = []
  for (const item of report.cases) {
    const spec = byId.get(item.caseId)
    if (!spec || spec.clueClass === 'negative') {
      continue
    }
    if (item.understandSource !== 'rules') {
      violations.push(`${item.caseId}: understandSource=${item.understandSource}`)
    }
  }
  return violations
}
