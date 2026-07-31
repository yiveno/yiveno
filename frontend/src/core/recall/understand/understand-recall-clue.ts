/**
 * 理解层：任意线索 → ParsedRecallClue（交给 Filter 的精确约束）。
 * 流程：网关（是否处理）→ 门禁（lexical/semantic）→ 规则 / LLM。
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
  selectClueProcessingDisposition,
  type ClueProcessingDisposition,
  type ClueProcessingRejectReason
} from '@/core/recall/understand/select-clue-processing-disposition'
import {
  selectClueUnderstandingMode,
  type ClueUnderstandingMode
} from '@/core/recall/understand/select-clue-understanding-mode'

/**
 * 实际用来产出结构的引擎。
 * - rules：规则 parser
 * - llm：LLM 成功
 * - rules_fallback：LLM 失败后降级规则
 * - rejected_noise：网关拒绝，未理解
 */
export type ClueUnderstandingSource =
  | 'rules' // 规则
  | 'llm' // LLM
  | 'rules_fallback' // LLM 失败降级规则
  | 'rejected_noise' // 网关拒绝噪音

export interface UnderstandRecallClueResult {
  /** 网关结论：reject 时下游应跳过扫库。 */
  disposition: ClueProcessingDisposition
  /** reject 时非 null。 */
  rejectReason: ClueProcessingRejectReason | null
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
  /** 单测：跳过网关，强制 proceed。 */
  skipNoiseGateway?: boolean
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

function emptyRejectedParsed(raw: string): ParsedRecallClue {
  return {
    raw,
    contentTerms: [],
    confidence: 'low'
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

  const decision = options.skipNoiseGateway
    ? ({ disposition: 'proceed', rejectReason: null } as const)
    : selectClueProcessingDisposition(raw)

  if (decision.disposition === 'reject_noise') {
    trace('info', '理解层：网关拒绝噪音', {
      disposition: 'reject_noise',
      rejectReason: decision.rejectReason,
      clue: raw,
      clueLength: raw.length
    })
    return {
      disposition: 'reject_noise',
      rejectReason: decision.rejectReason,
      mode: 'lexical',
      source: 'rejected_noise',
      parsed: emptyRejectedParsed(raw),
      searchClue: ''
    }
  }

  const mode = options.forceMode ?? selectClueUnderstandingMode(raw)
  const hasCompleter = Boolean(options.complete)

  trace('info', '理解层：开始', {
    clue: raw,
    clueLength: raw.length,
    disposition: 'proceed',
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
      disposition: 'proceed',
      rejectReason: null,
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
      disposition: 'proceed',
      rejectReason: null,
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
      disposition: 'proceed',
      rejectReason: null,
      mode,
      source: 'rules_fallback',
      parsed,
      searchClue
    }
  }
}
