/**
 * B 层画像事实：确定性算术（编译门 / 晋升 / 批准忽略 / trait 汇总 / 措辞）。
 * 数值来自设计 §9；不改 A 层 condition-credibility 初值表。
 */

import { z } from 'zod'

import {
  ConditionSlotSchema,
  ConditionSourceSchema,
  applyCredibilityEvent,
  clampCredibility,
  credibilityState,
  type ConditionSlot,
  type ConditionSource,
  type CredibilityState,
  type ScoredCondition
} from '@/core/recall/condition-credibility'

/** 画像离散态：复用四态 + decline 后的 invalid。 */
export type PortraitFactState = CredibilityState | 'invalid'

export const PortraitFactStateSchema = z.enum([
  'unconfirmed', // 未确认 <0.6
  'corroborated', // 已佐证 0.6–0.8
  'verified', // 已核实 ≥0.8
  'contested', // 有争议
  'invalid' // 用户忽略后失效
])

/** 单条观察来源。 */
export const PortraitFactSourceSchema = z.object({
  /** 来源类型（与 A 层 ConditionSource 同闭集） */
  type: ConditionSourceSchema,
  /** 可追溯引用（noteId / domain / session 等） */
  ref: z.string().min(1).max(400),
  /** 该次观察时的分数快照 */
  score: z.number().min(0).max(1),
  /** 观察时间 ISO */
  observedAt: z.string().datetime()
})

export type PortraitFactSource = z.infer<typeof PortraitFactSourceSchema>

/** B 层画像事实行（永不物理删除）。 */
export const PortraitFactRecordSchema = z.object({
  /** 主键：`${ownerId}\\0${slot}\\0${normalizedValue}` */
  id: z.string().min(1),
  /** 账号归属 */
  ownerId: z.string().uuid(),
  /** 槽位（复用 ConditionSlot） */
  slot: ConditionSlotSchema,
  /** 槽内值 */
  value: z.string().min(1).max(200),
  /** 可信度分数 [0.2, 1.0] */
  credibility: z.number().min(0).max(1),
  /** 离散态（含 invalid） */
  state: PortraitFactStateSchema,
  /** 独立观察来源列表 */
  sources: z.array(PortraitFactSourceSchema).min(0).max(64),
  /** 是否已过编译门进入画像 */
  inPortrait: z.boolean(),
  /** 创建时间 ISO */
  createdAt: z.string().datetime(),
  /** 最近更新 ISO */
  updatedAt: z.string().datetime()
})

export type PortraitFactRecord = z.infer<typeof PortraitFactRecordSchema>

/** 编译门：进画像最低分。 */
export const PORTRAIT_ENTER_MIN_CREDIBILITY = 0.6
/** 行为来源进画像所需独立观察数。 */
export const PORTRAIT_BEHAVIOR_MIN_SOURCES = 1
/** 陈述 / 推断进画像所需独立来源类型数。 */
export const PORTRAIT_STATEMENT_MIN_SOURCE_TYPES = 2
/** 晋升：确认后初始分下限。 */
export const PORTRAIT_PROMOTE_FLOOR = 0.6
/** 晋升：确认后当轮分加成。 */
export const PORTRAIT_PROMOTE_CONFIRM_BONUS = 0.1
/** 批准后核实分。 */
export const PORTRAIT_APPROVE_SCORE = 0.8
/** 忽略后下限分。 */
export const PORTRAIT_DECLINE_SCORE = 0.2
/** trait 汇总：每个独立源 +0.05。 */
export const PORTRAIT_TRAIT_SOURCE_BONUS = 0.05
/** 行为事实初始分。 */
export const PORTRAIT_BEHAVIOR_INITIAL = 0.8
/** 推断事实初始分。 */
export const PORTRAIT_INFERENCE_INITIAL = 0.4

const SCORE_FLOOR = 0.2

/** 规范化槽内值（小写 trim）。 */
export function normalizePortraitValue(value: string): string {
  return value.trim().toLowerCase()
}

/** 主键。 */
export function buildPortraitFactId(ownerId: string, slot: ConditionSlot, value: string): string {
  return `${ownerId}\0${slot}\0${normalizePortraitValue(value)}`
}

/** 独立来源类型数（去重 type）。 */
export function countDistinctSourceTypes(sources: readonly PortraitFactSource[]): number {
  return new Set(sources.map(s => s.type)).size
}

/**
 * 编译门：进画像 ⇔ 非 invalid ∧ credibility≥0.6 ∧ 独立观察达标。
 * 行为来源 ≥1 次观察即可；陈述/推断须 ≥2 个不同来源类型。
 */
export function shouldEnterPortrait(fact: {
  credibility: number
  state: PortraitFactState
  sources: readonly PortraitFactSource[]
}): boolean {
  if (fact.state === 'invalid') {
    return false
  }
  if (fact.credibility < PORTRAIT_ENTER_MIN_CREDIBILITY) {
    return false
  }
  if (fact.sources.length === 0) {
    return false
  }
  const hasBehavior = fact.sources.some(source => source.type === 'behavior')
  if (hasBehavior) {
    return fact.sources.filter(s => s.type === 'behavior').length >= PORTRAIT_BEHAVIOR_MIN_SOURCES
  }
  return countDistinctSourceTypes(fact.sources) >= PORTRAIT_STATEMENT_MIN_SOURCE_TYPES
}

/**
 * 解析离散态：invalid 优先；否则走 credibilityState。
 * hasCloseContradiction 由调用方按同槽多值判断。
 */
export function resolvePortraitFactState(
  credibility: number,
  options: { invalid?: boolean; hasCloseContradiction?: boolean } = {}
): PortraitFactState {
  if (options.invalid === true) {
    return 'invalid'
  }
  return credibilityState(credibility, options.hasCloseContradiction === true)
}

/**
 * trait 读时汇总：max(源分数) + 每个独立源类型 × 0.05（钳制到 [0.2, 1]）。
 * 不落库。
 */
export function aggregateTraitScore(facts: readonly PortraitFactRecord[]): number {
  const active = facts.filter(f => f.state !== 'invalid')
  if (active.length === 0) {
    return SCORE_FLOOR
  }
  const maxScore = Math.max(...active.map(f => f.credibility))
  const typeSet = new Set<ConditionSource>()
  for (const fact of active) {
    for (const source of fact.sources) {
      typeSet.add(source.type)
    }
  }
  return clampCredibility(maxScore + typeSet.size * PORTRAIT_TRAIT_SOURCE_BONUS)
}

/** 晋升初始分：max(0.6, 确认后当轮分 + 0.1)。 */
export function computePromoteInitialScore(confirmedCredibility: number): number {
  return clampCredibility(
    Math.max(PORTRAIT_PROMOTE_FLOOR, confirmedCredibility + PORTRAIT_PROMOTE_CONFIRM_BONUS)
  )
}

/**
 * 确认晋升：无同行 → 新行；有同行 → 追加确认来源 + 跨类佐证 +0.15。
 * 返回下一行快照（调用方负责落库）。
 */
export function promoteConditionToPortraitFact(input: {
  existing: PortraitFactRecord | null
  ownerId: string
  condition: ScoredCondition
  nowIso: string
  sourceRef: string
}): PortraitFactRecord {
  const value = normalizePortraitValue(input.condition.value)
  const slot = input.condition.slot
  const id = buildPortraitFactId(input.ownerId, slot, value)

  if (!input.existing) {
    // 确认即跨类佐证：陈述 + 打开确认（行为）→ 两源类型，分过 0.6 门即可进画像
    const credibility = computePromoteInitialScore(input.condition.credibility)
    const sources: PortraitFactSource[] = [
      {
        type: input.condition.source === 'inference' ? 'inference' : 'statement',
        ref: input.sourceRef,
        score: input.condition.credibility,
        observedAt: input.nowIso
      },
      {
        type: 'behavior',
        ref: `open_confirm:${input.sourceRef}`,
        score: credibility,
        observedAt: input.nowIso
      }
    ]
    const draft = {
      id,
      ownerId: input.ownerId,
      slot,
      value,
      credibility,
      state: resolvePortraitFactState(credibility),
      sources,
      inPortrait: false,
      createdAt: input.nowIso,
      updatedAt: input.nowIso
    }
    return {
      ...draft,
      inPortrait: shouldEnterPortrait(draft)
    }
  }

  const nextCredibility = applyCredibilityEvent(
    input.existing.credibility,
    'crossTypeCorroboration'
  )
  const sources: PortraitFactSource[] = [
    ...input.existing.sources,
    {
      type: 'behavior',
      ref: `open_confirm:${input.sourceRef}`,
      score: nextCredibility,
      observedAt: input.nowIso
    }
  ]
  const draft = {
    ...input.existing,
    credibility: nextCredibility,
    sources,
    updatedAt: input.nowIso,
    state: resolvePortraitFactState(nextCredibility) as PortraitFactState
  }
  return {
    ...draft,
    inPortrait: shouldEnterPortrait(draft),
    state: draft.state
  }
}

/** 对已有事实施矛盾（dismiss）。 */
export function applyPortraitContradiction(
  fact: PortraitFactRecord,
  nowIso: string
): PortraitFactRecord {
  if (fact.state === 'invalid') {
    return fact
  }
  const credibility = applyCredibilityEvent(fact.credibility, 'contradiction')
  const draft = {
    ...fact,
    credibility,
    updatedAt: nowIso,
    state: resolvePortraitFactState(credibility)
  }
  return {
    ...draft,
    inPortrait: shouldEnterPortrait(draft)
  }
}

/** 用户批准推断项 → 0.8 已核实 + 进画像。 */
export function applyPortraitApprove(
  fact: PortraitFactRecord,
  nowIso: string,
  sourceRef = 'user_approve'
): PortraitFactRecord {
  const credibility = clampCredibility(PORTRAIT_APPROVE_SCORE)
  const sources: PortraitFactSource[] = [
    ...fact.sources,
    {
      type: 'statement',
      ref: sourceRef,
      score: credibility,
      observedAt: nowIso
    }
  ]
  const draft = {
    ...fact,
    credibility,
    sources,
    updatedAt: nowIso,
    state: 'verified' as const,
    inPortrait: true
  }
  return draft
}

/** 用户忽略 → invalid、分 0.2、出画像；行保留。 */
export function applyPortraitDecline(fact: PortraitFactRecord, nowIso: string): PortraitFactRecord {
  return {
    ...fact,
    credibility: PORTRAIT_DECLINE_SCORE,
    state: 'invalid',
    inPortrait: false,
    updatedAt: nowIso
  }
}

/**
 * 重评 inPortrait / state（编译时对已有行）。
 * invalid 行不改。
 */
export function reevaluatePortraitFact(
  fact: PortraitFactRecord,
  options: { hasCloseContradiction?: boolean; nowIso: string } = {
    nowIso: new Date().toISOString()
  }
): PortraitFactRecord {
  if (fact.state === 'invalid') {
    return { ...fact, inPortrait: false }
  }
  const state = resolvePortraitFactState(fact.credibility, {
    ...(options.hasCloseContradiction !== undefined
      ? { hasCloseContradiction: options.hasCloseContradiction }
      : {})
  })
  const draft = { ...fact, state, updatedAt: options.nowIso }
  return {
    ...draft,
    inPortrait: shouldEnterPortrait(draft)
  }
}

/** 站点类事实启发式：值像域名（含点且无空格）。 */
export function looksLikeSiteFact(value: string): boolean {
  const v = normalizePortraitValue(value)
  if (!v || v.includes(' ') || !v.includes('.')) {
    return false
  }
  // 粗过滤：至少一段.tld
  return /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/i.test(v)
}

/**
 * §9.7 回答措辞档。
 * contested → juxtapose；其余按分数。
 */
export type PortraitWordingKind =
  | 'paraphrase' // <0.6 未确认：你提过喜欢 X
  | 'hedged' // 0.6–0.8：你好像喜欢 X
  | 'direct' // ≥0.8：你喜欢 X
  | 'juxtapose' // 有争议：并列

export function portraitWordingKind(
  credibility: number,
  state: PortraitFactState
): PortraitWordingKind {
  if (state === 'invalid') {
    return 'paraphrase'
  }
  if (state === 'contested') {
    return 'juxtapose'
  }
  if (credibility >= 0.8) {
    return 'direct'
  }
  if (credibility >= 0.6) {
    return 'hedged'
  }
  return 'paraphrase'
}
