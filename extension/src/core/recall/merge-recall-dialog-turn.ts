/**
 * 对话式 Recall：多轮槽位合并（确定性 · 非 UI 拼串）。
 * 本轮理解结果 refine accumulated；短补充（如 yesterday）不得冲掉 prior content。
 */

import { reconcilePositiveAndExcludeTerms } from '@/core/recall/exclude-content-terms'
import { parseRecallClue, resolveRecallClueConfidence } from '@/core/recall/parse-recall-clue'
import {
  ParsedRecallClueSchema,
  type ParsedRecallClue,
  type RecallBehaviorHint,
  type RecallObjectType
} from '@/core/recall/parse-recall-clue-types'

/** 合并模式：首轮 / 澄清补充。 */
export type RecallDialogMergeMode =
  | 'initial' // 首轮：无 accumulated
  | 'refine' // 补充：槽位 merge

/** Side Panel 会话内持有的寻回约束（不入 IndexedDB）。 */
export type RecallDialogState = {
  /** 已发送的用户轮次原文（有序；最多由调用方截断）。 */
  priorUserUtterances: string[]
  /** 上一轮合并后的解析结果。 */
  accumulated: ParsedRecallClue | null
  /** 本会话已否定的 MemoryItem id。 */
  dismissedIds: string[]
}

export type MergeRecallDialogTurnInput = {
  accumulated: ParsedRecallClue | null
  currentParsed: ParsedRecallClue
  priorUserUtterances: readonly string[]
  currentUtterance: string
}

export type MergeRecallDialogTurnResult = {
  merged: ParsedRecallClue
  mergeMode: RecallDialogMergeMode
  /** 合并后的有效原文（空格拼接 prior + 本轮）。 */
  effectiveRaw: string
}

const MAX_PRIOR_UTTERANCES_IN_RAW = 5

/** 去重并保持顺序（先出现优先）。 */
export function unionUniqueStrings(prior: readonly string[], next: readonly string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const term of [...prior, ...next]) {
    const normalized = term.trim()
    if (!normalized) {
      continue
    }
    const key = normalized.toLowerCase()
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    out.push(normalized)
  }
  return out
}

/** 行为提示并集（保持 prior 顺序，再追加本轮新项）。 */
export function unionBehaviorHints(
  prior: readonly RecallBehaviorHint[] | undefined,
  next: readonly RecallBehaviorHint[] | undefined
): RecallBehaviorHint[] | undefined {
  const merged = unionUniqueStrings(prior ?? [], next ?? []) as RecallBehaviorHint[]
  return merged.length > 0 ? merged : undefined
}

/** 由 prior 用户句 + 本轮拼 effectiveRaw。 */
export function buildEffectiveRecallRaw(
  priorUserUtterances: readonly string[],
  currentUtterance: string
): string {
  const current = currentUtterance.trim()
  const priors = priorUserUtterances
    .map(part => part.trim())
    .filter(Boolean)
    .slice(-MAX_PRIOR_UTTERANCES_IN_RAW)
  const parts = [...priors, ...(current ? [current] : [])]
  return parts.join(' ').trim()
}

/**
 * 合并两轮 ParsedRecallClue（槽位规则见产品文档 §7.0）。
 * - contentTerms：并集
 * - excludeContentTerms：并集，再与正词做冲突消解
 * - timeRange / objectTypes：本轮有则覆盖
 * - behaviorHints：并集
 * - noteHint：OR
 */
export function mergeParsedRecallClues(
  accumulated: ParsedRecallClue | null,
  current: ParsedRecallClue,
  effectiveRaw: string
): ParsedRecallClue {
  if (!accumulated) {
    return ParsedRecallClueSchema.parse({
      ...current,
      raw: effectiveRaw || current.raw
    })
  }

  const contentTermsMerged = unionUniqueStrings(accumulated.contentTerms, current.contentTerms)
  const excludeMerged = unionUniqueStrings(
    accumulated.excludeContentTerms ?? [],
    current.excludeContentTerms ?? []
  )
  const reconciled = reconcilePositiveAndExcludeTerms({
    contentTerms: contentTermsMerged,
    excludeContentTerms: excludeMerged
  })
  const contentTerms = reconciled.contentTerms
  const excludeContentTerms = reconciled.excludeContentTerms
  const timeRange = current.timeRange ?? accumulated.timeRange
  const timeConfidence = current.timeRange ? current.timeConfidence : accumulated.timeConfidence
  const objectTypes: RecallObjectType[] | undefined =
    current.objectTypes && current.objectTypes.length > 0
      ? current.objectTypes
      : accumulated.objectTypes
  const behaviorHints = unionBehaviorHints(accumulated.behaviorHints, current.behaviorHints)
  const noteHint = current.noteHint === true || accumulated.noteHint === true ? true : undefined

  const hasTime = Boolean(timeRange)
  const hasObject = Boolean(objectTypes && objectTypes.length > 0)
  const hasBehavior = Boolean(behaviorHints && behaviorHints.length > 0)
  const hasNote = noteHint === true
  const hasContent = contentTerms.length > 0

  return ParsedRecallClueSchema.parse({
    raw: effectiveRaw || current.raw || accumulated.raw,
    contentTerms,
    confidence: resolveRecallClueConfidence({
      hasTime,
      hasObject,
      hasBehavior,
      hasNote,
      hasContent
    }),
    ...(timeRange ? { timeRange } : {}),
    ...(timeRange && timeConfidence ? { timeConfidence } : {}),
    ...(objectTypes && objectTypes.length > 0 ? { objectTypes } : {}),
    ...(behaviorHints ? { behaviorHints } : {}),
    ...(noteHint ? { noteHint } : {}),
    ...(excludeContentTerms.length > 0 ? { excludeContentTerms } : {})
  })
}

/** 将本轮理解结果 merge 进会话 accumulated。 */
export function mergeRecallDialogTurn(
  input: MergeRecallDialogTurnInput
): MergeRecallDialogTurnResult {
  const currentUtterance = input.currentUtterance.trim()
  const effectiveRaw = buildEffectiveRecallRaw(input.priorUserUtterances, currentUtterance)
  const mergeMode: RecallDialogMergeMode = input.accumulated ? 'refine' : 'initial'
  const merged = mergeParsedRecallClues(input.accumulated, input.currentParsed, effectiveRaw)

  return { merged, mergeMode, effectiveRaw }
}

/** 从候选列表硬排除本会话已否定的 id。 */
export function excludeDismissedMemoryItems<T extends { id: string }>(
  items: readonly T[],
  dismissedIds: readonly string[] | undefined
): T[] {
  if (!dismissedIds || dismissedIds.length === 0) {
    return [...items]
  }
  const banned = new Set(dismissedIds)
  return items.filter(item => !banned.has(item.id))
}

/**
 * 将多轮用户原文按序规则 parse + 槽位 merge。
 * 供 eval / 缩短再试回滚 / 调试共用。
 */
export function mergeDialogUtterances(
  utterances: readonly string[],
  options: { nowMs?: number } = {}
): { merged: ParsedRecallClue | null; effectiveRaw: string } {
  const turns = utterances.map(part => part.trim()).filter(Boolean)
  if (turns.length === 0) {
    return { merged: null, effectiveRaw: '' }
  }

  const nowMs = options.nowMs
  let accumulated: ParsedRecallClue | null = null
  let prior: string[] = []
  let lastEffectiveRaw = ''
  let lastMerged: ParsedRecallClue | null = null

  for (const turn of turns) {
    const currentParsed = parseRecallClue(turn, nowMs === undefined ? {} : { nowMs })
    const result = mergeRecallDialogTurn({
      accumulated,
      currentParsed,
      priorUserUtterances: prior,
      currentUtterance: turn
    })
    accumulated = result.merged
    lastMerged = result.merged
    lastEffectiveRaw = result.effectiveRaw
    prior = [...prior, turn]
  }

  return { merged: lastMerged, effectiveRaw: lastEffectiveRaw }
}

/**
 * 缩短再试：丢掉会话中最后一句用户原文，并按剩余句重算 accumulated。
 * dismissedIds 原样保留。
 */
export function rollbackLastDialogUtterance(
  state: RecallDialogState,
  options: { nowMs?: number } = {}
): RecallDialogState {
  const remaining = state.priorUserUtterances.slice(0, -1)
  const { merged } = mergeDialogUtterances(remaining, options)
  return {
    priorUserUtterances: remaining,
    accumulated: merged,
    dismissedIds: [...state.dismissedIds]
  }
}
