import type { ParseGoldCase } from '@/core/recall/eval/parse-gold-cases'
import { PARSE_GOLD_CASES } from '@/core/recall/eval/parse-gold-cases'
import { judgeParseGoldCase } from '@/core/recall/eval/judge-parse-gold'
import { PARSE_GOLD_NOW_MS } from '@/core/recall/eval/parse-gold-now'
import { parseRecallClue } from '@/core/recall/parse-recall-clue'
import type { ParsedRecallClue } from '@/core/recall/parse-recall-clue-types'

/** 单条理解层金标结果。 */
export interface ParseGoldCaseResult {
  caseId: string
  gate: ParseGoldCase['gate']
  clue: string
  passed: boolean
  detail: string
  parsed: ParsedRecallClue
}

/** 汇总：must 挡门禁；stretch 仅汇报。 */
export interface ParseGoldReport {
  must: { total: number; passed: number; failed: ParseGoldCaseResult[] }
  stretch: { total: number; passed: number; failed: ParseGoldCaseResult[] }
  cases: ParseGoldCaseResult[]
}

function summarizeParseGoldResults(caseResults: ParseGoldCaseResult[]): ParseGoldReport {
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

/**
 * 用规则 parser 跑理解层金标（固定时钟）。
 * 可换同步解析器（如注入 fixture）。
 */
export function runParseGold(
  cases: ParseGoldCase[] = PARSE_GOLD_CASES,
  parse: (clue: string) => ParsedRecallClue = clue =>
    parseRecallClue(clue, { nowMs: PARSE_GOLD_NOW_MS })
): ParseGoldReport {
  const caseResults: ParseGoldCaseResult[] = cases.map(goldCase => {
    const parsed = parse(goldCase.clue)
    const judged = judgeParseGoldCase(goldCase, parsed)
    return {
      caseId: goldCase.id,
      gate: goldCase.gate,
      clue: goldCase.clue,
      passed: judged.passed,
      detail: judged.detail,
      parsed
    }
  })
  return summarizeParseGoldResults(caseResults)
}

/**
 * 异步解析器版（LLM eval）。
 * 单条失败时记 failed（低置信占位 parsed），不中断整集。
 * 若首条即鉴权失败，立刻停止后续请求以免刷配额/刷日志。
 */
export async function runParseGoldAsync(
  cases: ParseGoldCase[] = PARSE_GOLD_CASES,
  parse: (clue: string) => Promise<ParsedRecallClue>
): Promise<ParseGoldReport> {
  const caseResults: ParseGoldCaseResult[] = []
  let authFailedMessage: string | null = null

  for (const goldCase of cases) {
    if (authFailedMessage) {
      caseResults.push({
        caseId: goldCase.id,
        gate: goldCase.gate,
        clue: goldCase.clue,
        passed: false,
        detail: `解析跳过: ${authFailedMessage}`,
        parsed: {
          raw: goldCase.clue,
          contentTerms: [],
          confidence: 'low'
        }
      })
      continue
    }

    try {
      const parsed = await parse(goldCase.clue)
      const judged = judgeParseGoldCase(goldCase, parsed)
      caseResults.push({
        caseId: goldCase.id,
        gate: goldCase.gate,
        clue: goldCase.clue,
        passed: judged.passed,
        detail: judged.detail,
        parsed
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (/authentication|unauthorized|invalid.*api.?key|401/i.test(message)) {
        authFailedMessage = message
      }
      caseResults.push({
        caseId: goldCase.id,
        gate: goldCase.gate,
        clue: goldCase.clue,
        passed: false,
        detail: `解析失败: ${message}`,
        parsed: {
          raw: goldCase.clue,
          contentTerms: [],
          confidence: 'low'
        }
      })
    }
  }

  return summarizeParseGoldResults(caseResults)
}
