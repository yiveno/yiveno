/**
 * 理解层：任意线索 → ParsedRecallClue（交给 Filter 的精确约束）。
 * 有 LLM completer：默认一次 LLM 听懂（纯 URL 等例外走规则）；失败降级规则。
 * 不碰数据平面。见产品 §0.1.0。
 */

import { buildFilterClueFromParsed } from '@/core/recall/orchestrate-keyword-recall'
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
  /**
   * 理解模式（词面 vs 语义）。
   * 由 `selectClueUnderstandingMode` 或 `forceMode` 决定；与 `source` 不同（source=实际引擎）。
   */
  mode: ClueUnderstandingMode
  /**
   * 实际产出 `parsed` 的引擎。
   * Hybrid 写入 `pipelineTiming.understandSource` / 遥测。
   */
  source: ClueUnderstandingSource
  /**
   * 结构化检索约束。
   * Hybrid 下一环：`currentParsed: understood.parsed` → `mergeRecallDialogTurn`。
   * 网关拒绝时为占位空结构（confidence low、无 terms）。
   */
  parsed: ParsedRecallClue
  /** Filter 检索词面（`buildFilterClueFromParsed`；供调试；检索主输入仍是 parsed）。 */
  filterClue: string
}

export interface UnderstandRecallClueOptions {
  /** 解析时钟；缺省 Date.now()（相对时间窗依赖） */
  nowMs?: number
  /** 注入 LLM 补全；缺省则只能走规则。 */
  complete?: LlmChatCompleter
  /** 强制模式（单测 / Omnibox lexical / 调试）。 */
  forceMode?: ClueUnderstandingMode
  /** 流水线追踪（由 application 注入 logger）。 */
  trace?: ClueFlowTrace
  /** 单测：跳过网关，强制 proceed。 */
  skipNoiseGateway?: boolean
}

function summarizeParsed(parsed: ParsedRecallClue): Record<string, unknown> {
  return {
    contentTerms: parsed.contentTerms,
    excludeContentTerms: parsed.excludeContentTerms ?? [],
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
  const hasCompleter = Boolean(options.complete)

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
      filterClue: ''
    }
  }

  const mode =
    options.forceMode ?? selectClueUnderstandingMode(raw, { hasLlmCompleter: hasCompleter })

  trace('info', '理解层：开始', {
    clue: raw,
    clueLength: raw.length,
    disposition: 'proceed',
    mode,
    forceMode: options.forceMode ?? null,
    hasLlmCompleter: hasCompleter
  })

  // 无 completer，或强制/判定为 lexical（如纯 URL）→ 规则
  if (!options.complete || mode === 'lexical') {
    const reason = !options.complete ? 'no_llm_completer' : 'mode_lexical'
    const parsed = parseRecallClue(raw, { nowMs })
    const filterClue = buildFilterClueFromParsed(parsed)
    trace('info', '理解层：走规则', {
      reason,
      source: 'rules',
      filterClue,
      ...summarizeParsed(parsed)
    })
    return {
      disposition: 'proceed',
      rejectReason: null,
      mode,
      source: 'rules',
      parsed,
      filterClue
    }
  }

  trace('info', '理解层：尝试 LLM（默认主路径）', { mode })
  try {
    const parsed = await parseRecallClueWithLlm(raw, {
      nowMs,
      complete: options.complete,
      trace
    })
    const filterClue = buildFilterClueFromParsed(parsed)
    trace('info', '理解层：LLM 成功', {
      source: 'llm',
      filterClue,
      ...summarizeParsed(parsed)
    })
    return {
      disposition: 'proceed',
      rejectReason: null,
      mode,
      source: 'llm',
      parsed,
      filterClue
    }
  } catch (error) {
    const parsed = parseRecallClue(raw, { nowMs })
    const filterClue = buildFilterClueFromParsed(parsed)
    trace('warn', '理解层：LLM 失败，降级规则', {
      source: 'rules_fallback',
      error: error instanceof Error ? error.message : String(error),
      errorName: error instanceof Error ? error.name : typeof error,
      filterClue,
      ...summarizeParsed(parsed)
    })
    return {
      disposition: 'proceed',
      rejectReason: null,
      mode,
      source: 'rules_fallback',
      parsed,
      filterClue
    }
  }
}
