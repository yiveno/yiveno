/**
 * 对话式 Recall：多轮槽位合并（确定性 · 非 UI 拼串）。
 * 本轮理解结果 refine accumulated；短补充（如 yesterday）不得冲掉 prior content。
 */

import { mergeSessionConditions, type ScoredCondition } from '@/core/recall/condition-credibility'
import {
  normalizeExcludeContentTerms,
  reconcilePositiveAndExcludeTerms
} from '@/core/recall/exclude-content-terms'
import { normalizeRecallText } from '@/core/recall/keyword-filter'
import { parseRecallClue, resolveRecallClueConfidence } from '@/core/recall/parse-recall-clue'
import {
  ParsedRecallClueSchema,
  type ParsedRecallClue,
  type PreferenceOperator,
  type PreferenceTarget,
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
  /**
   * A 层会话条件（可信度计分；关 Panel / New find 丢弃）。
   * 不入 IndexedDB；不晋升 B 层。
   */
  conditions: ScoredCondition[]
  /**
   * 行为偏好轮换：本会话已展示过的候选位数（从 top1 起累计）。
   * 会话内；不入 IndexedDB。
   */
  behaviorShownCount?: number
}

export type MergeRecallDialogTurnInput = {
  /** 上一轮合并结果；首轮为 null */
  accumulated: ParsedRecallClue | null
  /** 本轮 `understandRecallClue` 产出的 parsed（Hybrid 的 currentParsed） */
  currentParsed: ParsedRecallClue
  /** 本轮之前已发送的用户原文（有序） */
  priorUserUtterances: readonly string[]
  /** 本轮用户原文 */
  currentUtterance: string
  /** 上一轮会话条件；缺省 = [] */
  priorConditions?: readonly ScoredCondition[]
  /** 合并时刻（条件 effectiveAtMs）；缺省 = Date.now() */
  nowMs?: number
}

export type MergeRecallDialogTurnResult = {
  /** 合并后的 ParsedRecallClue（供 topic / Filter / Hybrid） */
  merged: ParsedRecallClue
  /** 首轮 initial 或补充 refine */
  mergeMode: RecallDialogMergeMode
  /** 合并后的有效原文（空格拼接 prior + 本轮）。 */
  effectiveRaw: string
  /** 合并后的 A 层会话条件 */
  conditions: ScoredCondition[]
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
 * - contentTerms：并集；若本轮明确 exclude 命中 prior 正词 → 从正词侧拿掉（纠错优先）
 * - excludeContentTerms：并集，再与正词做冲突消解（同轮双挂仍保正词）
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

  // certainty：本轮有则覆盖对应展示；无则继承（条件计分走 conditions 数组）
  const certainty = current.certainty ?? accumulated.certainty

  /** 本轮明确排除 ∩ prior 正词 → 纠错优先，不走「同轮双挂保正词」。 */
  const turnExcludeNormalized = normalizeExcludeContentTerms(current.excludeContentTerms ?? [])
  const priorPositiveNormalized = new Set(
    accumulated.contentTerms
      .map(term => normalizeRecallText(term))
      .filter((term): term is string => Boolean(term))
  )
  const dropPositiveForTurnExclude = new Set(
    turnExcludeNormalized.filter(term => priorPositiveNormalized.has(term))
  )

  const contentTermsMerged = unionUniqueStrings(
    accumulated.contentTerms,
    current.contentTerms
  ).filter(term => {
    const normalized = normalizeRecallText(term)
    return !normalized || !dropPositiveForTurnExclude.has(normalized)
  })
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
  // 偏好算子：本轮有则覆盖；无则继承 accumulated
  const preferenceOperator: PreferenceOperator | undefined =
    current.preferenceOperator ?? accumulated.preferenceOperator
  const preferenceTarget: PreferenceTarget | undefined = current.preferenceOperator
    ? (current.preferenceTarget ?? 'site')
    : (current.preferenceTarget ?? accumulated.preferenceTarget)

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
    ...(preferenceOperator ? { preferenceOperator } : {}),
    ...(preferenceTarget ? { preferenceTarget } : {}),
    ...(noteHint ? { noteHint } : {}),
    ...(excludeContentTerms.length > 0 ? { excludeContentTerms } : {}),
    ...(certainty ? { certainty } : {})
  })
}

/** 将本轮理解结果 merge 进会话 accumulated（含 A 层条件计分）。 */
export function mergeRecallDialogTurn(
  input: MergeRecallDialogTurnInput
): MergeRecallDialogTurnResult {
  const currentUtterance = input.currentUtterance.trim()
  const effectiveRaw = buildEffectiveRecallRaw(input.priorUserUtterances, currentUtterance)
  const mergeMode: RecallDialogMergeMode = input.accumulated ? 'refine' : 'initial'
  const merged = mergeParsedRecallClues(input.accumulated, input.currentParsed, effectiveRaw)
  const turnIndex = input.priorUserUtterances.length
  const nowMs = input.nowMs ?? Date.now()
  const conditions = mergeSessionConditions({
    existing: input.priorConditions ?? [],
    incomingParsed: input.currentParsed,
    turnIndex,
    nowMs
  })

  return { merged, mergeMode, effectiveRaw, conditions }
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
): { merged: ParsedRecallClue | null; effectiveRaw: string; conditions: ScoredCondition[] } {
  const turns = utterances.map(part => part.trim()).filter(Boolean)
  if (turns.length === 0) {
    return { merged: null, effectiveRaw: '', conditions: [] }
  }

  const nowMs = options.nowMs
  let accumulated: ParsedRecallClue | null = null
  let prior: string[] = []
  let lastEffectiveRaw = ''
  let lastMerged: ParsedRecallClue | null = null
  let conditions: ScoredCondition[] = []

  for (const turn of turns) {
    const currentParsed = parseRecallClue(turn, nowMs === undefined ? {} : { nowMs })
    const result = mergeRecallDialogTurn({
      accumulated,
      currentParsed,
      priorUserUtterances: prior,
      currentUtterance: turn,
      priorConditions: conditions,
      ...(nowMs !== undefined ? { nowMs } : {})
    })
    accumulated = result.merged
    lastMerged = result.merged
    lastEffectiveRaw = result.effectiveRaw
    conditions = result.conditions
    prior = [...prior, turn]
  }

  return { merged: lastMerged, effectiveRaw: lastEffectiveRaw, conditions }
}

/**
 * 缩短再试：丢掉会话中最后一句用户原文，并按剩余句重算 accumulated。
 * dismissedIds 原样保留；conditions 按剩余句重算。
 */
export function rollbackLastDialogUtterance(
  state: RecallDialogState,
  options: { nowMs?: number } = {}
): RecallDialogState {
  const remaining = state.priorUserUtterances.slice(0, -1)
  const { merged, conditions } = mergeDialogUtterances(remaining, options)

  return {
    priorUserUtterances: remaining,
    accumulated: merged,
    dismissedIds: [...state.dismissedIds],
    conditions,
    ...(state.behaviorShownCount !== undefined
      ? { behaviorShownCount: state.behaviorShownCount }
      : {})
  }
}
