import type { ParseGoldCase } from '@/core/recall/eval/parse-gold-cases'
import { PARSE_GOLD_CASES } from '@/core/recall/eval/parse-gold-cases'
import { PARSE_GOLD_NOW_MS } from '@/core/recall/eval/parse-gold-now'
import {
  runParseGold,
  runParseGoldAsync,
  type ParseGoldReport
} from '@/core/recall/eval/run-parse-gold'
import {
  parseRecallClueWithLlm,
  type LlmChatCompleter
} from '@/core/recall/understand/parse-recall-clue-with-llm'
import { parseRecallClue } from '@/core/recall/parse-recall-clue'

/** 规则 vs LLM 对比报告。 */
export interface ParseGoldCompareReport {
  rules: ParseGoldReport
  llm: ParseGoldReport
  /** stretch：规则失败且 LLM 通过 */
  stretchLiftedByLlm: string[]
  /** must：规则通过且 LLM 失败（回归） */
  mustRegressedByLlm: string[]
  /** stretch：两边都失败 */
  stretchStillFailing: string[]
}

export interface CompareParseGoldOptions {
  cases?: ParseGoldCase[]
  complete: LlmChatCompleter
  nowMs?: number
}

/** 同一金标上对比规则 parser 与 LLM 解析器。 */
export async function compareParseGoldWithLlm(
  options: CompareParseGoldOptions
): Promise<ParseGoldCompareReport> {
  const cases = options.cases ?? PARSE_GOLD_CASES
  const nowMs = options.nowMs ?? PARSE_GOLD_NOW_MS

  const rules = runParseGold(cases, clue => parseRecallClue(clue, { nowMs }))
  const llm = await runParseGoldAsync(cases, clue =>
    parseRecallClueWithLlm(clue, { nowMs, complete: options.complete })
  )

  const byIdRules = new Map(rules.cases.map(item => [item.caseId, item]))
  const byIdLlm = new Map(llm.cases.map(item => [item.caseId, item]))

  const stretchLiftedByLlm: string[] = []
  const mustRegressedByLlm: string[] = []
  const stretchStillFailing: string[] = []

  for (const goldCase of cases) {
    const ruleCase = byIdRules.get(goldCase.id)
    const llmCase = byIdLlm.get(goldCase.id)
    if (!ruleCase || !llmCase) {
      continue
    }

    if (goldCase.gate === 'stretch') {
      if (!ruleCase.passed && llmCase.passed) {
        stretchLiftedByLlm.push(goldCase.id)
      }
      if (!ruleCase.passed && !llmCase.passed) {
        stretchStillFailing.push(goldCase.id)
      }
    }

    if (goldCase.gate === 'must' && ruleCase.passed && !llmCase.passed) {
      mustRegressedByLlm.push(goldCase.id)
    }
  }

  return {
    rules,
    llm,
    stretchLiftedByLlm,
    mustRegressedByLlm,
    stretchStillFailing
  }
}

/** 控制台摘要（CLI 用）。 */
export function formatParseGoldCompareSummary(report: ParseGoldCompareReport): string {
  const lines = [
    `[parse-gold] rules must ${report.rules.must.passed}/${report.rules.must.total} | stretch ${report.rules.stretch.passed}/${report.rules.stretch.total}`,
    `[parse-gold] llm   must ${report.llm.must.passed}/${report.llm.must.total} | stretch ${report.llm.stretch.passed}/${report.llm.stretch.total}`,
    `[parse-gold] stretch lifted by llm: ${report.stretchLiftedByLlm.length ? report.stretchLiftedByLlm.join(', ') : '(none)'}`,
    `[parse-gold] must regressed by llm: ${report.mustRegressedByLlm.length ? report.mustRegressedByLlm.join(', ') : '(none)'}`,
    `[parse-gold] stretch still failing: ${report.stretchStillFailing.length ? report.stretchStillFailing.join(', ') : '(none)'}`
  ]

  if (report.llm.must.failed.length > 0) {
    lines.push('[parse-gold] llm must failures:')
    for (const item of report.llm.must.failed) {
      lines.push(`  - ${item.caseId}: ${item.detail}`)
    }
  }
  if (report.llm.stretch.failed.length > 0) {
    lines.push('[parse-gold] llm stretch failures:')
    for (const item of report.llm.stretch.failed) {
      lines.push(`  - ${item.caseId}: ${item.detail}`)
    }
  }

  return lines.join('\n')
}
