/**
 * Recall Framing eval：事实层 must（不挡主路径 recall-eval，专测邻域说明）。
 */

import { buildRecallFramingFacts } from '@/core/recall/build-recall-framing-facts'
import { buildRecallEvalCorpus } from '@/core/recall/eval/recall-eval-corpus'
import { RECALL_EVAL_NOW_MS } from '@/core/recall/eval/recall-eval-now'
import { parseDialogTurnsToMerged, runRecallEval } from '@/core/recall/eval/run-recall-eval'
import { RECALL_EVAL_CASES } from '@/core/recall/eval/recall-eval-cases'
import { recallByKeywordWithParsedClue } from '@/core/recall/orchestrate-keyword-recall'
import type { RecallFramingCandidateFacts } from '@/core/recall/recall-framing-facts'
import type { RecallResult } from '@/core/recall/recall-result'

export type RecallFramingEvalGate = 'must' | 'stretch'

export type RecallFramingEvalCase = {
  id: string
  gate: RecallFramingEvalGate
  note: string
  run: () => RecallResult
  judge: (facts: RecallFramingCandidateFacts) => { passed: boolean; detail: string }
}

function requireCandidateFacts(result: RecallResult): RecallFramingCandidateFacts | null {
  const facts = buildRecallFramingFacts(result)
  if (!facts || facts.kind !== 'candidates') {
    return null
  }
  return facts
}

/** Framing must：闭集事实断言。 */
export const RECALL_FRAMING_EVAL_CASES: RecallFramingEvalCase[] = [
  {
    id: 'framing-constraint-neighborhood',
    gate: 'must',
    note: '宽邻域类型邻域：P2=constraint_neighborhood + P3 多桶',
    run: () => {
      const items = buildRecallEvalCorpus()
      const { merged } = parseDialogTurnsToMerged(['article'], RECALL_EVAL_NOW_MS)
      return recallByKeywordWithParsedClue(items, 'article', {
        nowMs: RECALL_EVAL_NOW_MS,
        parsed: merged
      })
    },
    judge: facts => {
      const passed =
        facts.retrievalPath === 'constraint_neighborhood' &&
        facts.buckets.length >= 2 &&
        facts.isWideNeighborhood
      return {
        passed,
        detail: passed
          ? 'constraint_neighborhood + ≥2 buckets'
          : `path=${facts.retrievalPath} buckets=${facts.buckets.length} wide=${facts.isWideNeighborhood}`
      }
    }
  },
  {
    id: 'framing-weak-literal',
    gate: 'must',
    note: '半模糊弱命中：P4=weak + P5 ambiguity',
    run: () => {
      const evalCase = RECALL_EVAL_CASES.find(
        item => item.id === 'negative-generic-page-title-only'
      )
      if (!evalCase) {
        throw new Error('missing eval case negative-generic-page-title-only')
      }
      return runRecallEval([evalCase]).cases[0]!.result
    },
    judge: facts => {
      const passed =
        facts.stance === 'weak_candidates' &&
        facts.retrievalPath === 'literal' &&
        Boolean(facts.ambiguity)
      return {
        passed,
        detail: passed
          ? 'weak_candidates + literal + ambiguity'
          : `stance=${facts.stance} path=${facts.retrievalPath} ambiguity=${facts.ambiguity?.kind ?? 'none'}`
      }
    }
  }
]

export function runRecallFramingEval(cases: RecallFramingEvalCase[] = RECALL_FRAMING_EVAL_CASES): {
  must: { total: number; passed: number; failed: Array<{ id: string; detail: string }> }
} {
  const results = cases.map(evalCase => {
    const result = evalCase.run()
    const facts = requireCandidateFacts(result)
    if (!facts) {
      return {
        id: evalCase.id,
        gate: evalCase.gate,
        passed: false,
        detail: `无 candidates framing（outcome=${result.outcome}）`
      }
    }
    const judged = evalCase.judge(facts)
    return {
      id: evalCase.id,
      gate: evalCase.gate,
      passed: judged.passed,
      detail: judged.detail
    }
  })

  const must = results.filter(item => item.gate === 'must')
  return {
    must: {
      total: must.length,
      passed: must.filter(item => item.passed).length,
      failed: must.filter(item => !item.passed).map(item => ({ id: item.id, detail: item.detail }))
    }
  }
}
