/**
 * 理解层：任意线索 → ParsedRecallClue（交给 Filter 的精确约束）。
 * LLM 只产出结构；失败降级规则。不碰数据平面。
 */

import { buildSearchClueFromParsed } from '@/core/recall/orchestrate-keyword-recall'
import { parseRecallClue } from '@/core/recall/parse-recall-clue'
import type { ParsedRecallClue } from '@/core/recall/parse-recall-clue-types'
import {
  parseRecallClueWithLlm,
  type LlmChatCompleter
} from '@/core/recall/understand/parse-recall-clue-with-llm'
import {
  selectClueUnderstandingMode,
  type ClueUnderstandingMode
} from '@/core/recall/understand/select-clue-understanding-mode'

/** 实际用来产出结构的引擎。 */
export type ClueUnderstandingSource = 'rules' | 'llm' | 'rules_fallback'

export interface UnderstandRecallClueResult {
  mode: ClueUnderstandingMode
  source: ClueUnderstandingSource
  parsed: ParsedRecallClue
  /** 交给 keyword-filter 的检索串（由 contentTerms 等拼出，供调试）。 */
  searchClue: string
}

export interface UnderstandRecallClueOptions {
  nowMs?: number
  /** 注入 LLM 补全；缺省则 semantic 也只能走规则。 */
  complete?: LlmChatCompleter
  /** 强制模式（单测 / 调试）。 */
  forceMode?: ClueUnderstandingMode
}

/** 将线索理解成精确检索约束。 */
export async function understandRecallClue(
  clue: string,
  options: UnderstandRecallClueOptions = {}
): Promise<UnderstandRecallClueResult> {
  const raw = clue.trim()
  const nowMs = options.nowMs ?? Date.now()
  const mode = options.forceMode ?? selectClueUnderstandingMode(raw)

  if (mode === 'lexical' || !options.complete) {
    const parsed = parseRecallClue(raw, { nowMs })
    return {
      mode,
      source: 'rules',
      parsed,
      searchClue: buildSearchClueFromParsed(parsed)
    }
  }

  try {
    const parsed = await parseRecallClueWithLlm(raw, {
      nowMs,
      complete: options.complete
    })
    return {
      mode,
      source: 'llm',
      parsed,
      searchClue: buildSearchClueFromParsed(parsed)
    }
  } catch {
    const parsed = parseRecallClue(raw, { nowMs })
    return {
      mode,
      source: 'rules_fallback',
      parsed,
      searchClue: buildSearchClueFromParsed(parsed)
    }
  }
}
