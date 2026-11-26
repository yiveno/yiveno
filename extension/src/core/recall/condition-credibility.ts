/**
 * A 层条件可信度：确定性算术（零 LLM、零配额）。
 * 数值来自设计 §9 初值表；dogfood 前不调参。
 */

import { z } from 'zod'

import {
  ConditionCertaintySchema,
  type ConditionCertainty,
  type ParsedRecallClue
} from '@/core/recall/parse-recall-clue-types'

export type { ConditionCertainty }

/** 条件来源。 */
export type ConditionSource =
  | 'behavior' // 行为观察
  | 'statement' // 用户陈述
  | 'inference' // 推断（Dreaming/LLM 合成）
  | 'correction' // 用户纠正产生的新事实

/** 可信度更新事件。 */
export type CredibilityEvent =
  | 'sameTypeCorroboration' // 同类佐证 +0.05
  | 'crossTypeCorroboration' // 跨类佐证 +0.15
  | 'contradiction' // 矛盾 -0.10
  | 'correction' // 纠正 -0.20（作用于被纠正目标）
  | 'siblingConfirm' // 同轮姊妹证实 +0.05
  | 'siblingRefute' // 同轮姊妹证伪 -0.05

/** 离散可信度状态。 */
export type CredibilityState =
  | 'unconfirmed' // 未确认 <0.6
  | 'corroborated' // 已佐证 0.6–0.8
  | 'verified' // 已核实 ≥0.8
  | 'contested' // 有争议（存在分差 ≤0.15 的矛盾事实）

/** A 层会话条件槽位（当轮 clue；不含 behaviorHints / noteHint）。 */
export type ConditionSlot =
  | 'contentTerm' // 内容词
  | 'objectType' // 对象类型
  | 'timeRange' // 相对时间
  | 'preferenceOperator' // 偏好算子

/** 条件槽位闭集（消息契约 / 单测共用）。 */
export const ConditionSlotSchema = z.enum([
  'contentTerm', // 内容词
  'objectType', // 对象类型
  'timeRange', // 相对时间
  'preferenceOperator' // 偏好算子
])

/** 条件来源闭集。 */
export const ConditionSourceSchema = z.enum([
  'behavior', // 行为观察
  'statement', // 用户陈述
  'inference', // 推断
  'correction' // 纠正产生的新事实
])

/** 会话级计分条件（关 Panel / New find 丢弃）。 */
export const ScoredConditionSchema = z.object({
  /** 槽位 */
  slot: ConditionSlotSchema,
  /** 槽内值（词面 / 类型 / 时间标签 / 算子） */
  value: z.string().min(1).max(200),
  /** 可信度分数 [0.2, 1.0] */
  credibility: z.number().min(0).max(1),
  /** 来源 */
  source: ConditionSourceSchema,
  /** 表达确定度 */
  certainty: ConditionCertaintySchema,
  /** 最近被提及的轮次（0-based） */
  lastMentionedTurn: z.number().int().nonnegative().max(100),
  /** 生效时间（ms；冲突平局用） */
  effectiveAtMs: z.number().int().nonnegative(),
  /**
   * 是否参与检索加权。
   * 冲突败者置 false，分数保留不删除。
   */
  active: z.boolean()
})

export type ScoredCondition = z.infer<typeof ScoredConditionSchema>

/** 同槽待合并的值（含先验分与元数据）。 */
export type ConditionValueInput = {
  value: string
  credibility: number
  source: ConditionSource
  certainty: ConditionCertainty
  lastMentionedTurn: number
  effectiveAtMs: number
  active?: boolean
}

const INITIAL: Record<ConditionSource, number> = {
  behavior: 0.8,
  statement: 0.5,
  inference: 0.4,
  correction: 0.7
}

const CERTAINTY_MOD: Record<ConditionCertainty, number> = {
  hedge: -0.1,
  neutral: 0,
  firm: 0.15
}

const EVENT_DELTA: Record<CredibilityEvent, number> = {
  sameTypeCorroboration: 0.05,
  crossTypeCorroboration: 0.15,
  contradiction: -0.1,
  correction: -0.2,
  siblingConfirm: 0.05,
  siblingRefute: -0.05
}

const SCORE_FLOOR = 0.2
const SCORE_CEILING = 1.0
const STATE_CORROBORATED = 0.6
const STATE_VERIFIED = 0.8
const CLOSE_CONTRADICTION_GAP = 0.15
const MERGE_OLD_PENALTY = 0.1
const RANK_MIN_CREDIBILITY = 0.3
const RELEVANCE_FLOOR = 0.2

/**
 * 条件加权 → 融合分的校准缩放。
 *
 * 融合分粒度：`hybrid-recall-backend` RRF 后 `score += max(0, 40-index)`，相邻名次差 ≥1；
 * 单条件 boost = credibility×relevance ≤1，scale=1 时几乎翻不动排名（behavior-ablation 机制轨零差异）。
 * 本常量只放大消费侧 boost，不改可信度初值/事件/状态阈值。
 *
 * 标定（2026-11-26 · `behavior-ablation` 冻结 fixture · 合成语料 + fake embedding）：
 * 逐档 1/2/4/6/8/9/10/11/12；取同时满足
 * ① 机制轨冲突子集 B-on vs B-off 出现可测排名差
 * ② 生产轨 ON-prod R@1 不低于修复前 74.62%
 * 的最小档 → **12**（≤11 机制轨仍零差异；12 起 2 条任务 top 排名变化，R@1 delta 仍为 0）。
 */
export const CONDITION_BOOST_FUSION_CALIBRATION_SCALE = 12

/** 钳制到 [0.2, 1.0]。 */
export function clampCredibility(score: number): number {
  if (!Number.isFinite(score)) {
    return SCORE_FLOOR
  }
  return Math.min(SCORE_CEILING, Math.max(SCORE_FLOOR, score))
}

/**
 * 初始可信度。
 * 表达确定性调制只作用于 statement：hedge -0.10，firm +0.15。
 */
export function initialCredibility(
  source: ConditionSource,
  certainty: ConditionCertainty = 'neutral'
): number {
  const base = INITIAL[source]
  if (source !== 'statement') {
    return clampCredibility(base)
  }
  return clampCredibility(base + CERTAINTY_MOD[certainty])
}

/**
 * 姊妹 ±0.05：单次调整不跨越离散状态边界（0.6 / 0.8）。
 */
function applySiblingDelta(score: number, delta: number): number {
  const raw = score + delta
  const boundaries = [STATE_CORROBORATED, STATE_VERIFIED]
  for (const boundary of boundaries) {
    if (score < boundary && raw >= boundary) {
      return clampCredibility(boundary - Number.EPSILON)
    }
    if (score >= boundary && raw < boundary) {
      return clampCredibility(boundary)
    }
  }
  return clampCredibility(raw)
}

/** 应用可信度事件；姊妹事件受状态边界约束。 */
export function applyCredibilityEvent(score: number, event: CredibilityEvent): number {
  const delta = EVENT_DELTA[event]
  if (event === 'siblingConfirm' || event === 'siblingRefute') {
    return applySiblingDelta(score, delta)
  }
  return clampCredibility(score + delta)
}

/**
 * 离散状态。
 * hasCloseContradiction：存在分差 ≤0.15 的矛盾事实 → 有争议。
 */
export function credibilityState(score: number, hasCloseContradiction: boolean): CredibilityState {
  if (hasCloseContradiction) {
    return 'contested'
  }
  if (score >= STATE_VERIFIED) {
    return 'verified'
  }
  if (score >= STATE_CORROBORATED) {
    return 'corroborated'
  }
  return 'unconfirmed'
}

/** weight = credibility × relevance。 */
export function credibilityWeight(score: number, relevance: number): number {
  return score * relevance
}

/**
 * 相关度：当轮 1.0；每过 3 个未提及轮次减半；下限 0.2。
 * @param turnsSinceMentioned 距上次提及的轮次数（0 = 当轮）
 */
export function relevanceForTurnsSinceMentioned(turnsSinceMentioned: number): number {
  const turns = Math.max(0, Math.floor(turnsSinceMentioned))
  const halvings = Math.floor(turns / 3)
  const relevance = 1.0 * Math.pow(0.5, halvings)
  return Math.max(RELEVANCE_FLOOR, relevance)
}

/**
 * 同槽多值共存：新值取自身先验；旧值 -0.10 保留；按权重排序。
 * 权重用 credibility × relevance（相关度按 lastMentionedTurn 相对 currentTurn）。
 */
export function mergeConditionValues(
  slot: ConditionSlot,
  existing: readonly ConditionValueInput[],
  incoming: readonly ConditionValueInput[],
  options: { currentTurn?: number } = {}
): ScoredCondition[] {
  const currentTurn =
    options.currentTurn ??
    Math.max(
      0,
      ...existing.map(row => row.lastMentionedTurn),
      ...incoming.map(row => row.lastMentionedTurn)
    )

  const byValue = new Map<string, ConditionValueInput>()
  for (const row of existing) {
    const key = row.value.trim().toLowerCase()
    if (!key) {
      continue
    }
    byValue.set(key, {
      ...row,
      value: key,
      credibility: clampCredibility(row.credibility)
    })
  }

  for (const row of incoming) {
    const key = row.value.trim().toLowerCase()
    if (!key) {
      continue
    }
    const prior = byValue.get(key)
    if (prior) {
      // 同会话重复：不计佐证，只刷新提及轮次 / 生效时间
      byValue.set(key, {
        ...prior,
        lastMentionedTurn: Math.max(prior.lastMentionedTurn, row.lastMentionedTurn),
        effectiveAtMs: Math.max(prior.effectiveAtMs, row.effectiveAtMs),
        certainty: row.certainty,
        source: row.source
      })
      continue
    }
    // 新值入槽：旧值各 -0.10（被争议）
    for (const [oldKey, oldRow] of byValue) {
      byValue.set(oldKey, {
        ...oldRow,
        credibility: clampCredibility(oldRow.credibility - MERGE_OLD_PENALTY)
      })
    }
    byValue.set(key, {
      ...row,
      value: key,
      credibility: clampCredibility(row.credibility)
    })
  }

  const scored: ScoredCondition[] = [...byValue.values()].map(row => ({
    slot,
    value: row.value,
    credibility: row.credibility,
    source: row.source,
    certainty: row.certainty,
    lastMentionedTurn: row.lastMentionedTurn,
    effectiveAtMs: row.effectiveAtMs,
    active: row.active !== false
  }))

  scored.sort((left, right) => {
    const leftW = credibilityWeight(
      left.credibility,
      relevanceForTurnsSinceMentioned(currentTurn - left.lastMentionedTurn)
    )
    const rightW = credibilityWeight(
      right.credibility,
      relevanceForTurnsSinceMentioned(currentTurn - right.lastMentionedTurn)
    )
    if (rightW !== leftW) {
      return rightW - leftW
    }
    return right.effectiveAtMs - left.effectiveAtMs
  })
  return scored
}

/**
 * 互斥槽冲突：高分胜；平局后有效时间胜；败者 active=false，不删除。
 * contentTerm / objectType 多值可并存，不做互斥失效。
 */
export function resolveConditionConflicts(
  conditions: readonly ScoredCondition[]
): ScoredCondition[] {
  const exclusiveSlots: ReadonlySet<ConditionSlot> = new Set(['timeRange', 'preferenceOperator'])
  const bySlot = new Map<ConditionSlot, ScoredCondition[]>()
  for (const row of conditions) {
    const list = bySlot.get(row.slot) ?? []
    list.push(row)
    bySlot.set(row.slot, list)
  }

  const out: ScoredCondition[] = []
  for (const [slot, rows] of bySlot) {
    if (!exclusiveSlots.has(slot) || rows.length <= 1) {
      out.push(...rows.map(row => ({ ...row, active: row.active !== false })))
      continue
    }
    const ranked = [...rows].sort((left, right) => {
      if (right.credibility !== left.credibility) {
        return right.credibility - left.credibility
      }
      return right.effectiveAtMs - left.effectiveAtMs
    })
    const winnerKey = `${ranked[0]!.value}`
    for (const row of ranked) {
      out.push({
        ...row,
        active: row.value === winnerKey
      })
    }
  }
  return out
}

/** 是否存在分差 ≤0.15 的同槽矛盾（多值共存）。 */
export function hasCloseContradictionInSlot(
  conditions: readonly ScoredCondition[],
  slot: ConditionSlot
): boolean {
  const rows = conditions.filter(row => row.slot === slot)
  if (rows.length < 2) {
    return false
  }
  for (let i = 0; i < rows.length; i += 1) {
    for (let j = i + 1; j < rows.length; j += 1) {
      if (Math.abs(rows[i]!.credibility - rows[j]!.credibility) <= CLOSE_CONTRADICTION_GAP) {
        return true
      }
    }
  }
  return false
}

/**
 * 用户行为确认：产生该结果的条件跨类佐证 +0.15，同轮姊妹 +0.05。
 * confirmedValues 空 → 全部条件视为「产生结果」（只加跨类，避免姊妹双计）。
 */
export function applyUserConfirmToConditions(
  conditions: readonly ScoredCondition[],
  confirmedValues: ReadonlySet<string> = new Set()
): ScoredCondition[] {
  const confirmed = new Set([...confirmedValues].map(v => v.trim().toLowerCase()))
  if (confirmed.size === 0) {
    return conditions.map(row => ({
      ...row,
      credibility: applyCredibilityEvent(row.credibility, 'crossTypeCorroboration')
    }))
  }
  const hitIndexes = new Set<number>()
  conditions.forEach((row, index) => {
    if (confirmed.has(row.value.trim().toLowerCase())) {
      hitIndexes.add(index)
    }
  })
  if (hitIndexes.size === 0) {
    return conditions.map(row => ({
      ...row,
      credibility: applyCredibilityEvent(row.credibility, 'crossTypeCorroboration')
    }))
  }
  return conditions.map((row, index) => {
    if (hitIndexes.has(index)) {
      return {
        ...row,
        credibility: applyCredibilityEvent(row.credibility, 'crossTypeCorroboration')
      }
    }
    return {
      ...row,
      credibility: applyCredibilityEvent(row.credibility, 'siblingConfirm')
    }
  })
}

/**
 * 用户否定 / dismiss：对应条件矛盾 -0.10，同轮姊妹 -0.05。
 * refutedValues 空 → 全部条件施矛盾（dismiss 整池；不双计姊妹）。
 */
export function applyUserRefuteToConditions(
  conditions: readonly ScoredCondition[],
  refutedValues: ReadonlySet<string> = new Set()
): ScoredCondition[] {
  const refuted = new Set([...refutedValues].map(v => v.trim().toLowerCase()))
  if (refuted.size === 0) {
    return conditions.map(row => ({
      ...row,
      credibility: applyCredibilityEvent(row.credibility, 'contradiction')
    }))
  }
  const hitIndexes = new Set<number>()
  conditions.forEach((row, index) => {
    if (refuted.has(row.value.trim().toLowerCase())) {
      hitIndexes.add(index)
    }
  })
  if (hitIndexes.size === 0) {
    return conditions.map(row => ({
      ...row,
      credibility: applyCredibilityEvent(row.credibility, 'contradiction')
    }))
  }
  return conditions.map((row, index) => {
    if (hitIndexes.has(index)) {
      return {
        ...row,
        credibility: applyCredibilityEvent(row.credibility, 'contradiction')
      }
    }
    return {
      ...row,
      credibility: applyCredibilityEvent(row.credibility, 'siblingRefute')
    }
  })
}

/**
 * 检索消费：候选分 += Σ (命中 × 可信度 × 相关度) × scale；永不硬过滤。
 * 可信度 <0.3 或 inactive 的条件不参与排序。
 * `scale` 缺省 1：保持纯函数既有语义（单测 / 直接调用不变）。
 */
export function applyConditionBoosts<T extends { score: number }>(
  candidates: readonly T[],
  conditions: readonly ScoredCondition[],
  hitFn: (candidate: T, condition: ScoredCondition) => boolean,
  options: { currentTurn?: number; scale?: number } = {}
): T[] {
  const currentTurn =
    options.currentTurn ?? Math.max(0, ...conditions.map(row => row.lastMentionedTurn), 0)
  const scale =
    options.scale === undefined
      ? 1
      : Number.isFinite(options.scale) && options.scale > 0
        ? options.scale
        : 1

  const rankingConditions = conditions.filter(
    row => row.active !== false && row.credibility >= RANK_MIN_CREDIBILITY
  )

  return candidates.map(candidate => {
    let boost = 0
    for (const condition of rankingConditions) {
      if (!hitFn(candidate, condition)) {
        continue
      }
      const relevance = relevanceForTurnsSinceMentioned(currentTurn - condition.lastMentionedTurn)
      boost += credibilityWeight(condition.credibility, relevance)
    }
    if (boost === 0) {
      return candidate
    }
    return { ...candidate, score: candidate.score + boost * scale }
  })
}

/** 理解回显：不按可信度过滤（低分仍展示）。 */
export function conditionsForUnderstandingEcho(
  conditions: readonly ScoredCondition[]
): ScoredCondition[] {
  return [...conditions]
}

/** 参与排序的条件（<0.3 与 inactive 排除）。 */
export function conditionsForRanking(conditions: readonly ScoredCondition[]): ScoredCondition[] {
  return conditions.filter(row => row.active !== false && row.credibility >= RANK_MIN_CREDIBILITY)
}

export const CONDITION_CREDIBILITY_CONSTANTS = {
  SCORE_FLOOR,
  SCORE_CEILING,
  STATE_CORROBORATED,
  STATE_VERIFIED,
  CLOSE_CONTRADICTION_GAP,
  MERGE_OLD_PENALTY,
  RANK_MIN_CREDIBILITY,
  RELEVANCE_FLOOR
} as const

/** 从本轮 parsed 抽出 A 层陈述条件（behaviorHints / noteHint 不入）。 */
export function conditionsFromParsed(
  parsed: ParsedRecallClue,
  turnIndex: number,
  nowMs: number
): ScoredCondition[] {
  const certainty = parsed.certainty
  const out: ScoredCondition[] = []

  for (const term of parsed.contentTerms) {
    const key = term.trim().toLowerCase()
    if (!key) {
      continue
    }
    const c = certainty?.contentTerms?.[key] ?? 'neutral'
    out.push({
      slot: 'contentTerm',
      value: key,
      credibility: initialCredibility('statement', c),
      source: 'statement',
      certainty: c,
      lastMentionedTurn: turnIndex,
      effectiveAtMs: nowMs,
      active: true
    })
  }

  if (parsed.timeRange?.label) {
    const label = parsed.timeRange.label.trim().toLowerCase()
    const c = certainty?.timeRange ?? 'neutral'
    out.push({
      slot: 'timeRange',
      value: label,
      credibility: initialCredibility('statement', c),
      source: 'statement',
      certainty: c,
      lastMentionedTurn: turnIndex,
      effectiveAtMs: nowMs,
      active: true
    })
  }

  for (const type of parsed.objectTypes ?? []) {
    const key = type.trim().toLowerCase()
    const c = certainty?.objectTypes?.[key] ?? certainty?.objectTypes?.[type] ?? 'neutral'
    out.push({
      slot: 'objectType',
      value: key,
      credibility: initialCredibility('statement', c),
      source: 'statement',
      certainty: c,
      lastMentionedTurn: turnIndex,
      effectiveAtMs: nowMs,
      active: true
    })
  }

  if (parsed.preferenceOperator) {
    const c = certainty?.preferenceOperator ?? 'neutral'
    out.push({
      slot: 'preferenceOperator',
      value: parsed.preferenceOperator,
      credibility: initialCredibility('statement', c),
      source: 'statement',
      certainty: c,
      lastMentionedTurn: turnIndex,
      effectiveAtMs: nowMs,
      active: true
    })
  }

  return out
}

/**
 * 合并会话 A 层条件：按槽 mergeConditionValues；同会话重复不计佐证；
 * 互斥槽冲突败者失效不删除。
 */
export function mergeSessionConditions(input: {
  existing: readonly ScoredCondition[]
  incomingParsed: ParsedRecallClue
  turnIndex: number
  nowMs: number
}): ScoredCondition[] {
  const incoming = conditionsFromParsed(input.incomingParsed, input.turnIndex, input.nowMs)
  const slots: ConditionSlot[] = ['contentTerm', 'objectType', 'timeRange', 'preferenceOperator']
  const merged: ScoredCondition[] = []
  for (const slot of slots) {
    const existingRows = input.existing
      .filter(row => row.slot === slot)
      .map(row => ({
        value: row.value,
        credibility: row.credibility,
        source: row.source,
        certainty: row.certainty,
        lastMentionedTurn: row.lastMentionedTurn,
        effectiveAtMs: row.effectiveAtMs,
        active: row.active
      }))
    const incomingRows = incoming
      .filter(row => row.slot === slot)
      .map(row => ({
        value: row.value,
        credibility: row.credibility,
        source: row.source,
        certainty: row.certainty,
        lastMentionedTurn: row.lastMentionedTurn,
        effectiveAtMs: row.effectiveAtMs,
        active: row.active
      }))
    if (existingRows.length === 0 && incomingRows.length === 0) {
      continue
    }
    if (incomingRows.length === 0) {
      merged.push(
        ...existingRows.map(row => ({
          slot,
          value: row.value,
          credibility: row.credibility,
          source: row.source,
          certainty: row.certainty,
          lastMentionedTurn: row.lastMentionedTurn,
          effectiveAtMs: row.effectiveAtMs,
          active: row.active !== false
        }))
      )
      continue
    }
    merged.push(
      ...mergeConditionValues(slot, existingRows, incomingRows, {
        currentTurn: input.turnIndex
      })
    )
  }
  return resolveConditionConflicts(merged)
}
