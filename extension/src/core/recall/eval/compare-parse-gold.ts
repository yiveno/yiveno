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
import { clearLlmParseCache } from '@/core/recall/understand/llm-parse-cache'
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
  /**
   * 是否使用 llm-parse-cache（默认 false）。
   * 离线对比默认关：缓存键不含 model，避免同进程串模；生产路径不走本函数。
   */
  useCache?: boolean
}

/**
 * 同一金标上对比规则 parser 与 LLM 解析器。
 * 开始前 `clearLlmParseCache()`；默认 `useCache: false` 防止串模。
 */
export async function compareParseGoldWithLlm(
  options: CompareParseGoldOptions
): Promise<ParseGoldCompareReport> {
  const cases = options.cases ?? PARSE_GOLD_CASES
  const nowMs = options.nowMs ?? PARSE_GOLD_NOW_MS
  const useCache = options.useCache === true

  clearLlmParseCache()

  const rules = runParseGold(cases, clue => parseRecallClue(clue, { nowMs }))
  const llm = await runParseGoldAsync(cases, clue =>
    parseRecallClueWithLlm(clue, { nowMs, complete: options.complete, useCache })
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
