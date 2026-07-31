/**
 * 理解层：任意线索 → ParsedRecallClue（交给 Filter 的精确约束）。
 * LLM 只产出结构；失败降级规则。不碰数据平面。
 */

import { buildSearchClueFromParsed } from '@/core/recall/orchestrate-keyword-recall'
import { parseRecallClue } from '@/core/recall/parse-recall-clue'
import type { ParsedRecallClue } from '@/core/recall/parse-recall-clue-types'
import { type ClueFlowTrace, noopClueFlowTrace } from '@/core/recall/understand/clue-flow-trace'
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
  /** 流水线追踪（由 application 注入 logger）。 */
  trace?: ClueFlowTrace
}

function summarizeParsed(parsed: ParsedRecallClue): Record<string, unknown> {
  return {
    contentTerms: parsed.contentTerms,
    timeLabel: parsed.timeRange?.label ?? null,
    objectTypes: parsed.objectTypes ?? null,
    behaviorHints: parsed.behaviorHints ?? null,
    noteHint: parsed.noteHint ?? false,
    confidence: parsed.confidence
  }
}

/** 将线索理解成精确检索约束。 */
export async function understandRecallClue(
  clue: string,
  options: UnderstandRecallClueOptions = {}
): Promise<UnderstandRecallClueResult> {
  const raw = clue.trim()
  const nowMs = options.nowMs ?? Date.now()
  const trace = options.trace ?? noopClueFlowTrace
  const mode = options.forceMode ?? selectClueUnderstandingMode(raw)
  const hasCompleter = Boolean(options.complete)

  trace('info', '理解层：开始', {
    clue: raw,
    clueLength: raw.length,
    mode,
    forceMode: options.forceMode ?? null,
    hasLlmCompleter: hasCompleter
  })

  if (mode === 'lexical' || !options.complete) {
    const reason = mode === 'lexical' ? 'mode_lexical' : 'no_llm_completer'
    const parsed = parseRecallClue(raw, { nowMs })
    const searchClue = buildSearchClueFromParsed(parsed)
    trace('info', '理解层：走规则', {
      reason,
      source: 'rules',
      searchClue,
      ...summarizeParsed(parsed)
    })
    return {
      mode,
      source: 'rules',
      parsed,
      searchClue
    }
  }

  trace('info', '理解层：尝试 LLM', { mode })
  try {
    const parsed = await parseRecallClueWithLlm(raw, {
      nowMs,
      complete: options.complete,
      trace
    })
    const searchClue = buildSearchClueFromParsed(parsed)
    trace('info', '理解层：LLM 成功', {
      source: 'llm',
      searchClue,
      ...summarizeParsed(parsed)
    })
    return {
      mode,
      source: 'llm',
      parsed,
      searchClue
    }
  } catch (error) {
    const parsed = parseRecallClue(raw, { nowMs })
    const searchClue = buildSearchClueFromParsed(parsed)
    trace('warn', '理解层：LLM 失败，降级规则', {
      source: 'rules_fallback',
      error: error instanceof Error ? error.message : String(error),
      errorName: error instanceof Error ? error.name : typeof error,
      searchClue,
      ...summarizeParsed(parsed)
    })
    return {
      mode,
      source: 'rules_fallback',
      parsed,
      searchClue
    }
  }
}
