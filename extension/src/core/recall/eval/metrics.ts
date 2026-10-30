/**
 * 分层评测指标（Phase A）——纯函数，无 Chrome / 无网络。
 *
 * 口径（与 docs/audits/2026-10-三类模型独立评测与归因方案.md §4 对齐）：
 * - 位次一律 **1-based**；有序列表先按「首次出现」去重（并列/重复 id 取最先位）。
 * - **Recall@K / MRR / nDCG@K** 衡量的是「给定有序候选集合」的覆盖或排序，
 *   **不**证明理解槽位正确，也 **不** dual 证明 Embedding 根因。
 * - **槽位一致率** 衡量 NLU 相对金标**字段**是否通过（与 `diffParseGoldSlots` 同构）；
 *   **不是**词项级 Precision / Recall / F1；**不**等同 Schema/Zod 通过，更 **不** 等于找得到。
 * - 协议版本：`SLOT_AGREEMENT_PROTOCOL`（字段级 v1；含 excludeContentTerms + 正/负分列）。
 */

import type { ParseGoldSlots } from '@/core/recall/eval/parse-gold-cases'
import type { ParsedRecallClue } from '@/core/recall/parse-recall-clue-types'

/** 字段级槽位一致率协议；旧 parse-gold JSON（schemaVersion 1）不含本协议。 */
export const SLOT_AGREEMENT_PROTOCOL = 'field-v1' as const
export type SlotAgreementProtocol = typeof SLOT_AGREEMENT_PROTOCOL

/** 有序 id 去重：保留首次出现，稳定。 */
export function stabilizeRankedIds(rankedIds: readonly string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of rankedIds) {
    if (seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

/**
 * 金标在有序列表中的 1-based 位次；不在则为 null。
 * 空 goldId → null。
 */
export function rankOfGold(rankedIds: readonly string[], goldId: string): number | null {
  if (!goldId) {
    return null
  }
  const stable = stabilizeRankedIds(rankedIds)
  const index = stable.indexOf(goldId)
  return index < 0 ? null : index + 1
}

export interface RecallAtKResult {
  /** 目标是否出现在稳定序前 K */
  hit: boolean
  /** 1-based 位次；未命中为 null */
  rank: number | null
  /** 实际用于截断的 K（传入 ≤0 时按 0 处理 → 永不命中） */
  k: number
}

/**
 * Recall@K（单查询）。
 * - 分母语义（聚合时）：见 `meanRecallAtK`。
 * - 空列表 / 目标缺失 / k≤0 → hit=false。
 */
export function recallAtK(
  rankedIds: readonly string[],
  goldId: string,
  k: number
): RecallAtKResult {
  const safeK = Math.max(0, Math.floor(k))
  const rank = rankOfGold(rankedIds, goldId)
  const hit = rank !== null && safeK > 0 && rank <= safeK
  return { hit, rank, k: safeK }
}

export interface MeanMetricOptions {
  /**
   * 目标不在全列表时是否计入分母。
   * - `include_miss_as_zero`（默认）：经典 IR，miss → 贡献 0，分母含该查询。
   * - `exclude_miss`：协议记 NA 时用；miss 不进分母（分母可为 0 → mean=null）。
   */
  missPolicy?: 'include_miss_as_zero' | 'exclude_miss'
}

export interface MeanRecallAtKResult {
  /** 命中率；无有效样本时 null */
  mean: number | null
  hitCount: number
  /** 分母：按 missPolicy 计入的查询数 */
  denominator: number
  k: number
}

/** 多查询平均 Recall@K。 */
export function meanRecallAtK(
  queries: readonly { rankedIds: readonly string[]; goldId: string }[],
  k: number,
  options?: MeanMetricOptions
): MeanRecallAtKResult {
  const missPolicy = options?.missPolicy ?? 'include_miss_as_zero'
  let hitCount = 0
  let denominator = 0
  for (const query of queries) {
    const { hit, rank } = recallAtK(query.rankedIds, query.goldId, k)
    const missingEntirely = rank === null
    if (missingEntirely && missPolicy === 'exclude_miss') {
      continue
    }
    denominator += 1
    if (hit) {
      hitCount += 1
    }
  }
  return {
    mean: denominator === 0 ? null : hitCount / denominator,
    hitCount,
    denominator,
    k: Math.max(0, Math.floor(k))
  }
}

/**
 * 单查询 MRR 贡献：命中则 1/rank，否则 0。
 * 聚合分母见 `meanMrr`。
 */
export function mrrContribution(rankedIds: readonly string[], goldId: string): number {
  const rank = rankOfGold(rankedIds, goldId)
  if (rank === null) {
    return 0
  }
  return 1 / rank
}

export interface MeanMrrResult {
  mean: number | null
  denominator: number
  sum: number
}

/** 多查询 MRR（Mean Reciprocal Rank）。 */
export function meanMrr(
  queries: readonly { rankedIds: readonly string[]; goldId: string }[],
  options?: MeanMetricOptions
): MeanMrrResult {
  const missPolicy = options?.missPolicy ?? 'include_miss_as_zero'
  let sum = 0
  let denominator = 0
  for (const query of queries) {
    const rank = rankOfGold(query.rankedIds, query.goldId)
    if (rank === null && missPolicy === 'exclude_miss') {
      continue
    }
    denominator += 1
    if (rank !== null) {
      sum += 1 / rank
    }
  }
  return {
    mean: denominator === 0 ? null : sum / denominator,
    denominator,
    sum
  }
}

/**
 * 单相关 nDCG@K（二元相关）。
 * - 理想 DCG（单相关）= 1 / log2(2) = 1 → nDCG = DCG。
 * - 目标位次 r（1-based）且 r≤K → 1/log2(r+1)；否则 0。
 * - 空列表 / 缺失 / k≤0 → 0。
 */
export function ndcgAtK(rankedIds: readonly string[], goldId: string, k: number): number {
  const safeK = Math.max(0, Math.floor(k))
  if (safeK <= 0 || !goldId) {
    return 0
  }
  const rank = rankOfGold(rankedIds, goldId)
  if (rank === null || rank > safeK) {
    return 0
  }
  return 1 / Math.log2(rank + 1)
}

export interface MeanNdcgAtKResult {
  mean: number | null
  denominator: number
  sum: number
  k: number
}

/** 多查询平均 nDCG@K。 */
export function meanNdcgAtK(
  queries: readonly { rankedIds: readonly string[]; goldId: string }[],
  k: number,
  options?: MeanMetricOptions
): MeanNdcgAtKResult {
  const missPolicy = options?.missPolicy ?? 'include_miss_as_zero'
  let sum = 0
  let denominator = 0
  for (const query of queries) {
    const rank = rankOfGold(query.rankedIds, query.goldId)
    const missingEntirely = rank === null
    if (missingEntirely && missPolicy === 'exclude_miss') {
      continue
    }
    denominator += 1
    sum += ndcgAtK(query.rankedIds, query.goldId, k)
  }
  return {
    mean: denominator === 0 ? null : sum / denominator,
    denominator,
    sum,
    k: Math.max(0, Math.floor(k))
  }
}

/** 槽位字段检查名（仅金标声明的字段进入分母）。 */
export type SlotAgreementField =
  | 'timeLabel'
  | 'objectTypes'
  | 'behaviorHints'
  | 'noteHint'
  | 'contentTerms'
  | 'confidence'
  | 'excludeContentTerms'

/** 正向槽：时间 / 类型 / 行为 / 附注 / 正词 / 置信度。 */
export const SLOT_AGREEMENT_POSITIVE_FIELDS = [
  'timeLabel',
  'objectTypes',
  'behaviorHints',
  'noteHint',
  'contentTerms',
  'confidence'
] as const satisfies readonly SlotAgreementField[]

/** 负向槽：明确排除词项集合（字段级布尔，非词项 F1）。 */
export const SLOT_AGREEMENT_NEGATIVE_FIELDS = [
  'excludeContentTerms'
] as const satisfies readonly SlotAgreementField[]

export interface SlotAgreementBucketResult {
  /** 该桶内已检查字段是否通过 */
  fields: Partial<Record<SlotAgreementField, boolean>>
  checkedCount: number
  passedCount: number
  /**
   * passedCount / checkedCount；
   * checkedCount===0 → null（NA，不进该桶宏观分母）。
   */
  agreement: number | null
}

export interface SlotAgreementResult {
  /** 各已检查字段是否通过（正+负） */
  fields: Partial<Record<SlotAgreementField, boolean>>
  checkedCount: number
  passedCount: number
  /**
   * 全字段 agreement（辅助）；checkedCount===0 → null（NA）。
   * 主口径请看 `positive` / `negative`，避免负向被正向字段数稀释。
   */
  agreement: number | null
  positive: SlotAgreementBucketResult
  negative: SlotAgreementBucketResult
}

function sortedCopy(values: string[]): string[] {
  return [...values].sort((a, b) => a.localeCompare(b))
}

function sameStringSet(actual: string[], expected: string[]): boolean {
  const a = sortedCopy(actual)
  const b = sortedCopy(expected)
  if (a.length !== b.length) {
    return false
  }
  return a.every((value, index) => value === b[index])
}

function bucketFromFields(
  fields: Partial<Record<SlotAgreementField, boolean>>
): SlotAgreementBucketResult {
  const entries = Object.values(fields) as boolean[]
  const checkedCount = entries.length
  const passedCount = entries.filter(Boolean).length
  return {
    fields,
    checkedCount,
    passedCount,
    agreement: checkedCount === 0 ? null : passedCount / checkedCount
  }
}

/**
 * 正词槽字段级判定（与 `diffParseGoldSlots` 的 contentTerms* 失败条件同构：
 * Exact / MustInclude / MustExclude 任一声明则合成单字段布尔；全未声明 → null）。
 */
function judgeContentTerms(parsed: ParsedRecallClue, expect: ParseGoldSlots): boolean | null {
  const hasInclude = expect.contentTermsMustInclude !== undefined
  const hasExclude = expect.contentTermsMustExclude !== undefined
  const hasExact = expect.contentTermsExact === true
  if (!hasInclude && !hasExclude && !hasExact) {
    return null
  }

  const terms = parsed.contentTerms
  let ok = true
  if (hasInclude) {
    const required = expect.contentTermsMustInclude ?? []
    ok = ok && required.every(term => terms.includes(term))
  }
  if (hasExclude) {
    const banned = expect.contentTermsMustExclude ?? []
    ok = ok && banned.every(term => !terms.includes(term))
  }
  if (hasExact) {
    const required = expect.contentTermsMustInclude ?? []
    ok = ok && sameStringSet(terms, required)
  }
  return ok
}

/**
 * 排除槽字段级判定（与 `diffParseGoldSlots` 的 excludeContentTerms* 同构：
 * Empty / MustInclude / MustExclude / Exact 全部满足才通过；全未声明 → null）。
 */
function judgeExcludeContentTerms(
  parsed: ParsedRecallClue,
  expect: ParseGoldSlots
): boolean | null {
  const hasEmpty = expect.excludeContentTermsEmpty === true
  const hasInclude = expect.excludeContentTermsMustInclude !== undefined
  const hasBanned = expect.excludeContentTermsMustExclude !== undefined
  const hasExact = expect.excludeContentTermsExact === true
  if (!hasEmpty && !hasInclude && !hasBanned && !hasExact) {
    return null
  }

  const excludeTerms = parsed.excludeContentTerms ?? []
  let ok = true
  if (hasEmpty) {
    ok = ok && excludeTerms.length === 0
  }
  if (hasInclude) {
    const required = expect.excludeContentTermsMustInclude ?? []
    ok = ok && required.every(term => excludeTerms.includes(term))
  }
  if (hasBanned) {
    const banned = expect.excludeContentTermsMustExclude ?? []
    ok = ok && banned.every(term => !excludeTerms.includes(term))
  }
  if (hasExact) {
    const required = expect.excludeContentTermsMustInclude ?? []
    ok = ok && sameStringSet(excludeTerms, required)
  }
  return ok
}

/**
 * 单条 clue 的字段级槽位一致率（相对金标 `ParseGoldSlots`）。
 * 字段省略 = 不进分母；`null` 期望（time/objectTypes/behaviorHints）= 必须缺失。
 */
export function slotAgreement(
  parsed: ParsedRecallClue,
  expect: ParseGoldSlots
): SlotAgreementResult {
  const fields: Partial<Record<SlotAgreementField, boolean>> = {}

  if (expect.timeLabel !== undefined) {
    const actualLabel = parsed.timeRange?.label ?? null
    fields.timeLabel = actualLabel === expect.timeLabel
  }

  if (expect.objectTypes !== undefined) {
    const actual = parsed.objectTypes ?? []
    fields.objectTypes =
      expect.objectTypes === null ? actual.length === 0 : sameStringSet(actual, expect.objectTypes)
  }

  if (expect.behaviorHints !== undefined) {
    const actual = parsed.behaviorHints ?? []
    fields.behaviorHints =
      expect.behaviorHints === null
        ? actual.length === 0
        : sameStringSet(actual, expect.behaviorHints)
  }

  if (expect.noteHint !== undefined) {
    fields.noteHint = (parsed.noteHint === true) === expect.noteHint
  }

  const content = judgeContentTerms(parsed, expect)
  if (content !== null) {
    fields.contentTerms = content
  }

  if (expect.confidence !== undefined) {
    fields.confidence = parsed.confidence === expect.confidence
  }

  const exclude = judgeExcludeContentTerms(parsed, expect)
  if (exclude !== null) {
    fields.excludeContentTerms = exclude
  }

  const positiveFields: Partial<Record<SlotAgreementField, boolean>> = {}
  for (const key of SLOT_AGREEMENT_POSITIVE_FIELDS) {
    if (fields[key] !== undefined) {
      positiveFields[key] = fields[key]
    }
  }
  const negativeFields: Partial<Record<SlotAgreementField, boolean>> = {}
  for (const key of SLOT_AGREEMENT_NEGATIVE_FIELDS) {
    if (fields[key] !== undefined) {
      negativeFields[key] = fields[key]
    }
  }

  const overall = bucketFromFields(fields)
  return {
    ...overall,
    positive: bucketFromFields(positiveFields),
    negative: bucketFromFields(negativeFields)
  }
}

export interface MeanSlotAgreementResult {
  /** 宏观平均：各条 agreement 的算术平均；无有效样本时 null */
  mean: number | null
  /** 分母：agreement !== null 的条数 */
  denominator: number
  sum: number
}

/** 多条槽位一致率宏观平均（每条先算 agreement，再平均）。 */
export function meanSlotAgreement(
  results: readonly Pick<SlotAgreementBucketResult, 'agreement'>[]
): MeanSlotAgreementResult {
  let sum = 0
  let denominator = 0
  for (const item of results) {
    if (item.agreement === null) {
      continue
    }
    denominator += 1
    sum += item.agreement
  }
  return {
    mean: denominator === 0 ? null : sum / denominator,
    denominator,
    sum
  }
}

/** 单字段命中率：声明该字段的案中通过占比（字段级，非词项 P/R）。 */
export interface SlotAgreementFieldHitRate {
  /** 金标声明了该字段的条数（分母） */
  declaredCount: number
  /** 字段通过条数 */
  passedCount: number
  /** passedCount / declaredCount；declaredCount===0 → null（NA） */
  hitRate: number | null
}

export interface SlotAgreementAggregateBucket {
  /** 各案该桶 agreement 的算术平均；无有效案 → null（NA） */
  mean: number | null
  /** 该桶 agreement !== null 的案数 */
  denominator: number
  /** 分字段命中率（仅出现过的字段；未出现字段不写入，读侧视为 NA） */
  perFieldHitRate: Partial<Record<SlotAgreementField, SlotAgreementFieldHitRate>>
}

/**
 * 多案正/负/overall 聚合。
 * - positive / negative 为主口径；overall 仅辅助。
 * - 未声明字段不进分母；空分母 mean / hitRate = null（报告写 NA）。
 */
export function aggregateSlotAgreement(results: readonly SlotAgreementResult[]): {
  protocol: SlotAgreementProtocol
  positive: SlotAgreementAggregateBucket
  negative: SlotAgreementAggregateBucket
  overall: SlotAgreementAggregateBucket
} {
  const buildBucket = (
    pick: (row: SlotAgreementResult) => SlotAgreementBucketResult,
    fieldKeys: readonly SlotAgreementField[]
  ): SlotAgreementAggregateBucket => {
    const buckets = results.map(pick)
    const mean = meanSlotAgreement(buckets)
    const perFieldHitRate: Partial<Record<SlotAgreementField, SlotAgreementFieldHitRate>> = {}
    for (const field of fieldKeys) {
      let declaredCount = 0
      let passedCount = 0
      for (const bucket of buckets) {
        const value = bucket.fields[field]
        if (value === undefined) {
          continue
        }
        declaredCount += 1
        if (value) {
          passedCount += 1
        }
      }
      if (declaredCount === 0) {
        continue
      }
      perFieldHitRate[field] = {
        declaredCount,
        passedCount,
        hitRate: passedCount / declaredCount
      }
    }
    return {
      mean: mean.mean,
      denominator: mean.denominator,
      perFieldHitRate
    }
  }

  const positiveKeys: readonly SlotAgreementField[] = SLOT_AGREEMENT_POSITIVE_FIELDS
  const negativeKeys: readonly SlotAgreementField[] = SLOT_AGREEMENT_NEGATIVE_FIELDS
  return {
    protocol: SLOT_AGREEMENT_PROTOCOL,
    positive: buildBucket(row => row.positive, positiveKeys),
    negative: buildBucket(row => row.negative, negativeKeys),
    overall: buildBucket(row => row, [...positiveKeys, ...negativeKeys])
  }
}

/**
 * 由 parse-gold 跑批结果 + 金标 expect 表计算字段级一致率汇总。
 * 缺 expect 的 case 视为空金标（全 NA），不抛错。
 */
export function summarizeSlotAgreementForParseGold(
  cases: readonly { caseId: string; parsed: ParsedRecallClue }[],
  expectByCaseId: ReadonlyMap<string, ParseGoldSlots>
): {
  protocol: SlotAgreementProtocol
  perCase: Array<{ caseId: string; slotAgreement: SlotAgreementResult }>
  aggregate: ReturnType<typeof aggregateSlotAgreement>
} {
  const perCase = cases.map(item => {
    const expect = expectByCaseId.get(item.caseId) ?? {}
    return {
      caseId: item.caseId,
      slotAgreement: slotAgreement(item.parsed, expect)
    }
  })
  return {
    protocol: SLOT_AGREEMENT_PROTOCOL,
    perCase,
    aggregate: aggregateSlotAgreement(perCase.map(row => row.slotAgreement))
  }
}

/** 控制台一行：正/负主口径 + overall 辅助。 */
export function formatSlotAgreementAggregateSummary(aggregate: {
  protocol: SlotAgreementProtocol
  positive: SlotAgreementAggregateBucket
  negative: SlotAgreementAggregateBucket
  overall: SlotAgreementAggregateBucket
}): string {
  const fmtMean = (bucket: SlotAgreementAggregateBucket): string => {
    if (bucket.mean === null) {
      return `NA (n=${bucket.denominator})`
    }
    return `${bucket.mean.toFixed(3)} (n=${bucket.denominator})`
  }
  const fmtField = (bucket: SlotAgreementAggregateBucket, field: SlotAgreementField): string => {
    const hit = bucket.perFieldHitRate[field]
    if (!hit) {
      return `${field}=NA`
    }
    const rate = hit.hitRate === null ? 'NA' : hit.hitRate.toFixed(3)
    return `${field}=${rate}(${hit.passedCount}/${hit.declaredCount})`
  }
  const positiveFields = SLOT_AGREEMENT_POSITIVE_FIELDS.map(f =>
    fmtField(aggregate.positive, f)
  ).join(' ')
  const negativeFields = SLOT_AGREEMENT_NEGATIVE_FIELDS.map(f =>
    fmtField(aggregate.negative, f)
  ).join(' ')
  return [
    `[parse-gold] slotAgreement protocol=${aggregate.protocol} (field-level; not term P/R/F1)`,
    `[parse-gold] slotAgreement positive mean=${fmtMean(aggregate.positive)} | ${positiveFields}`,
    `[parse-gold] slotAgreement negative mean=${fmtMean(aggregate.negative)} | ${negativeFields}`,
    `[parse-gold] slotAgreement overall  mean=${fmtMean(aggregate.overall)} (auxiliary)`
  ].join('\n')
}
