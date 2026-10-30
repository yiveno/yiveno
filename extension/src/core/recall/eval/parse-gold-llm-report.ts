/**
 * parse-gold LLM 离线对比的机器可读报告（不接生产路径）。
 *
 * schemaVersion 2：含字段级 slotAgreement（正/负分列）；schemaVersion 1 旧快照不含该块，禁止静默当作已评。
 */

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  classifyParseGoldFailure,
  type ParseGoldFailureKind
} from '@/core/recall/eval/classify-parse-gold-failure'
import type { ParseGoldCompareReport } from '@/core/recall/eval/compare-parse-gold'
import {
  SLOT_AGREEMENT_PROTOCOL,
  summarizeSlotAgreementForParseGold,
  type SlotAgreementAggregateBucket,
  type SlotAgreementProtocol,
  type SlotAgreementResult
} from '@/core/recall/eval/metrics'
import { PARSE_GOLD_CASES, type ParseGoldSlots } from '@/core/recall/eval/parse-gold-cases'
import type { ParseGoldCaseResult } from '@/core/recall/eval/run-parse-gold'
import type {
  OpenAiCompatibleChatCompat,
  OpenAiCompatibleChatUsage
} from '@/core/recall/understand/openai-compatible-chat'

/** 含 slotAgreement 正/负分列的报告 schema；旧快照为 1。 */
export const PARSE_GOLD_LLM_REPORT_SCHEMA_VERSION = 2 as const

/** 单次 completer 调用的实测元数据（与 case 按调用序对齐）。 */
export interface ParseGoldCompleterCallMetric {
  latencyMs: number
  usage: OpenAiCompatibleChatUsage
}

/** 报告内单条用例（LLM 侧）。 */
export interface ParseGoldLlmCaseReportRow {
  caseId: string
  gate: 'must' | 'stretch'
  clue: string
  passed: boolean
  /** 管道分层：schema / slot / skip（勿与产品 L1/L2/L3 混读） */
  failureKind: ParseGoldFailureKind
  detail: string
  /** 字段级槽位一致率；agreement=null 表示该桶无声明字段（NA） */
  slotAgreement: SlotAgreementResult
  /** 墙钟；无对应 API 调用则为 null → 序列化时写 MISSING */
  latencyMs: number | null
  promptTokens: number | null
  completionTokens: number | null
  totalTokens: number | null
}

/** 指纹文件相对仓库根的路径。 */
export const PARSE_GOLD_LLM_FINGERPRINT_REL_PATHS = [
  'extension/src/core/recall/understand/build-llm-parse-prompt.ts',
  'extension/src/core/recall/understand/llm-parsed-clue-proposal.ts',
  'extension/src/core/recall/understand/parse-recall-clue-with-llm.ts',
  'extension/src/core/recall/eval/parse-gold-cases.ts',
  'extension/src/core/recall/eval/parse-gold-now.ts',
  'extension/src/core/recall/eval/judge-parse-gold.ts',
  'extension/src/core/recall/eval/metrics.ts'
] as const

export interface BuildParseGoldLlmJsonReportInput {
  compare: ParseGoldCompareReport
  meta: {
    capturedAt: string
    gitSha: string
    model: string
    baseUrl: string
    compat: OpenAiCompatibleChatCompat
    temperature: number
    maxTokens: number
    disableThinking: boolean
    nowMsIso: string
    nowMs: number
    gateFilter: string
    caseCount: number
    command: string
    /** 仓库根绝对路径，用于读指纹文件 */
    repoRoot: string
  }
  /** 与「实际调用了 completer」的 case 同序；跳过项不占位 */
  callMetrics: ParseGoldCompleterCallMetric[]
}

/** 报告内可序列化的槽位聚合（mean/hitRate 为 null → 序列化写 NA）。 */
export interface ParseGoldLlmSlotAgreementReport {
  /** 与 metrics.SLOT_AGREEMENT_PROTOCOL 一致 */
  protocol: SlotAgreementProtocol
  /** 明确：字段级布尔一致率，不是词项 Precision/Recall/F1 */
  metricKind: 'field_agreement'
  note: string
  /** 主口径：正向槽 */
  positive: SlotAgreementAggregateBucket
  /** 主口径：负向排除槽 */
  negative: SlotAgreementAggregateBucket
  /** 辅助：正+负混合；禁止单独用它宣称排除质量 */
  overall: SlotAgreementAggregateBucket
}

export interface ParseGoldLlmJsonReport {
  schemaVersion: typeof PARSE_GOLD_LLM_REPORT_SCHEMA_VERSION
  capturedAt: string
  gitSha: string
  model: string
  baseUrl: string
  compat: OpenAiCompatibleChatCompat
  temperature: number
  maxTokens: number
  disableThinking: boolean
  nowMsIso: string
  nowMs: number
  gateFilter: string
  caseCount: number
  command: string
  fingerprintsSha256: Record<string, string>
  /** 字段级槽位一致率（正/负分列）；schemaVersion≥2 必有 */
  slotAgreement: ParseGoldLlmSlotAgreementReport
  layers: {
    L1_schema: {
      /** 完成 JSON→Zod→map 且未抛错的条数（含随后 L2 失败） */
      passed: number
      failed: number
      skipped: number
      failedCaseIds: string[]
    }
    L2_parse_gold: {
      rules: { must: string; stretch: string }
      llm: { must: string; stretch: string }
      stretchLiftedByLlm: string[]
      mustRegressedByLlm: string[]
      stretchStillFailing: string[]
      llmMustFailures: Array<{ id: string; failureKind: ParseGoldFailureKind; detail: string }>
      llmStretchFailures: Array<{ id: string; failureKind: ParseGoldFailureKind; detail: string }>
    }
    L3_recall_hybrid: 'NOT_RUN'
  }
  cases: ParseGoldLlmCaseReportRow[]
  /** 有实测 latency 的汇总；样本为 0 时字段为 null */
  latencyMsSummary: {
    n: number
    p50: number | null
    p95: number | null
    min: number | null
    max: number | null
  }
  tokensSummary: {
    promptSum: number | null
    completionSum: number | null
    totalSum: number | null
    note: string
  }
}

function sha256File(absPath: string): string {
  const buf = readFileSync(absPath)
  return createHash('sha256').update(buf).digest('hex')
}

function percentileSorted(sorted: number[], p: number): number | null {
  if (sorted.length === 0) {
    return null
  }
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))
  return sorted[idx] ?? null
}

function summarizeGate(report: {
  must: { total: number; passed: number }
  stretch: { total: number; passed: number }
}): { must: string; stretch: string } {
  return {
    must: `${report.must.passed}/${report.must.total}`,
    stretch: `${report.stretch.passed}/${report.stretch.total}`
  }
}

function buildExpectByCaseId(): Map<string, ParseGoldSlots> {
  return new Map(PARSE_GOLD_CASES.map(item => [item.id, item.expect]))
}

function serializeAgreementNa(value: number | null): number | 'NA' {
  return value === null ? 'NA' : value
}

function serializeSlotAgreementBucket(bucket: SlotAgreementAggregateBucket): unknown {
  const perFieldHitRate: Record<string, unknown> = {}
  for (const [field, hit] of Object.entries(bucket.perFieldHitRate)) {
    if (!hit) {
      continue
    }
    perFieldHitRate[field] = {
      declaredCount: hit.declaredCount,
      passedCount: hit.passedCount,
      hitRate: serializeAgreementNa(hit.hitRate)
    }
  }
  return {
    mean: serializeAgreementNa(bucket.mean),
    denominator: bucket.denominator,
    perFieldHitRate
  }
}

function serializeSlotAgreementResult(result: SlotAgreementResult): unknown {
  const serializeBucket = (bucket: SlotAgreementResult['positive']): unknown => ({
    fields: bucket.fields,
    checkedCount: bucket.checkedCount,
    passedCount: bucket.passedCount,
    agreement: serializeAgreementNa(bucket.agreement)
  })
  return {
    fields: result.fields,
    checkedCount: result.checkedCount,
    passedCount: result.passedCount,
    agreement: serializeAgreementNa(result.agreement),
    positive: serializeBucket(result.positive),
    negative: serializeBucket(result.negative)
  }
}

function rowFromCase(
  item: ParseGoldCaseResult,
  metric: ParseGoldCompleterCallMetric | null,
  slot: SlotAgreementResult
): ParseGoldLlmCaseReportRow {
  const failureKind = classifyParseGoldFailure(item)
  return {
    caseId: item.caseId,
    gate: item.gate,
    clue: item.clue,
    passed: item.passed,
    failureKind,
    detail: item.detail,
    slotAgreement: slot,
    latencyMs: metric?.latencyMs ?? null,
    promptTokens: metric?.usage.promptTokens ?? null,
    completionTokens: metric?.usage.completionTokens ?? null,
    totalTokens: metric?.usage.totalTokens ?? null
  }
}

/**
 * 将对比报告 + completer 调用序指标打成 JSON 可序列化结构。
 * 跳过（鉴权）的 case 不消耗 callMetrics 下标。
 * 不改变 must 回归判定；仅附加字段级 slotAgreement。
 */
export function buildParseGoldLlmJsonReport(
  input: BuildParseGoldLlmJsonReportInput
): ParseGoldLlmJsonReport {
  const fingerprintsSha256: Record<string, string> = {}
  for (const rel of PARSE_GOLD_LLM_FINGERPRINT_REL_PATHS) {
    fingerprintsSha256[rel] = sha256File(resolve(input.meta.repoRoot, rel))
  }

  const slotSummary = summarizeSlotAgreementForParseGold(
    input.compare.llm.cases,
    buildExpectByCaseId()
  )
  const slotByCaseId = new Map(slotSummary.perCase.map(row => [row.caseId, row.slotAgreement]))

  let metricIndex = 0
  const cases: ParseGoldLlmCaseReportRow[] = input.compare.llm.cases.map(item => {
    const slot = slotByCaseId.get(item.caseId) ?? {
      fields: {},
      checkedCount: 0,
      passedCount: 0,
      agreement: null,
      positive: { fields: {}, checkedCount: 0, passedCount: 0, agreement: null },
      negative: { fields: {}, checkedCount: 0, passedCount: 0, agreement: null }
    }
    const kind = classifyParseGoldFailure(item)
    if (kind === 'skip') {
      return rowFromCase(item, null, slot)
    }
    const metric = input.callMetrics[metricIndex] ?? null
    metricIndex += 1
    return rowFromCase(item, metric, slot)
  })

  const l1Failed = cases.filter(c => c.failureKind === 'schema')
  const l1Skipped = cases.filter(c => c.failureKind === 'skip')
  const l1Passed = cases.length - l1Failed.length - l1Skipped.length

  const latencies = cases
    .map(c => c.latencyMs)
    .filter((n): n is number => typeof n === 'number')
    .sort((a, b) => a - b)

  const promptTokens = cases.map(c => c.promptTokens)
  const completionTokens = cases.map(c => c.completionTokens)
  const totalTokens = cases.map(c => c.totalTokens)
  const allPromptKnown = promptTokens.every(n => typeof n === 'number')
  const allCompletionKnown = completionTokens.every(n => typeof n === 'number')
  const allTotalKnown = totalTokens.every(n => typeof n === 'number')
  const anyTokenKnown = [...promptTokens, ...completionTokens, ...totalTokens].some(
    n => typeof n === 'number'
  )

  const sumKnown = (xs: Array<number | null>): number | null => {
    if (!xs.every(n => typeof n === 'number')) {
      return null
    }
    return xs.reduce<number>((acc, n) => acc + (n as number), 0)
  }

  return {
    schemaVersion: PARSE_GOLD_LLM_REPORT_SCHEMA_VERSION,
    capturedAt: input.meta.capturedAt,
    gitSha: input.meta.gitSha,
    model: input.meta.model,
    baseUrl: input.meta.baseUrl,
    compat: input.meta.compat,
    temperature: input.meta.temperature,
    maxTokens: input.meta.maxTokens,
    disableThinking: input.meta.disableThinking,
    nowMsIso: input.meta.nowMsIso,
    nowMs: input.meta.nowMs,
    gateFilter: input.meta.gateFilter,
    caseCount: input.meta.caseCount,
    command: input.meta.command,
    fingerprintsSha256,
    slotAgreement: {
      protocol: SLOT_AGREEMENT_PROTOCOL,
      metricKind: 'field_agreement',
      note: 'Field-level pass rate vs ParseGoldSlots (same as diffParseGoldSlots). Not term-level Precision/Recall/F1. Positive/negative are primary; overall is auxiliary.',
      positive: slotSummary.aggregate.positive,
      negative: slotSummary.aggregate.negative,
      overall: slotSummary.aggregate.overall
    },
    layers: {
      L1_schema: {
        passed: l1Passed,
        failed: l1Failed.length,
        skipped: l1Skipped.length,
        failedCaseIds: l1Failed.map(c => c.caseId)
      },
      L2_parse_gold: {
        rules: summarizeGate(input.compare.rules),
        llm: summarizeGate(input.compare.llm),
        stretchLiftedByLlm: [...input.compare.stretchLiftedByLlm],
        mustRegressedByLlm: [...input.compare.mustRegressedByLlm],
        stretchStillFailing: [...input.compare.stretchStillFailing],
        llmMustFailures: input.compare.llm.must.failed.map(item => ({
          id: item.caseId,
          failureKind: classifyParseGoldFailure(item),
          detail: item.detail
        })),
        llmStretchFailures: input.compare.llm.stretch.failed.map(item => ({
          id: item.caseId,
          failureKind: classifyParseGoldFailure(item),
          detail: item.detail
        }))
      },
      L3_recall_hybrid: 'NOT_RUN'
    },
    cases,
    latencyMsSummary: {
      n: latencies.length,
      p50: percentileSorted(latencies, 50),
      p95: percentileSorted(latencies, 95),
      min: latencies[0] ?? null,
      max: latencies.length ? (latencies[latencies.length - 1] ?? null) : null
    },
    tokensSummary: {
      promptSum: allPromptKnown ? sumKnown(promptTokens) : null,
      completionSum: allCompletionKnown ? sumKnown(completionTokens) : null,
      totalSum: allTotalKnown ? sumKnown(totalTokens) : null,
      note: anyTokenKnown
        ? allPromptKnown && allCompletionKnown && allTotalKnown
          ? 'sums from API usage fields only'
          : 'partial usage; sums null unless every case has that field (MISSING mixed → no fake sum)'
        : 'MISSING — API responses had no usage fields'
    }
  }
}

/**
 * JSON.stringify 时：
 * - latency/token null → "MISSING"（避免误读为 0）
 * - slotAgreement agreement/mean/hitRate null → "NA"（未声明 / 空分母）
 */
export function serializeParseGoldLlmJsonReport(report: ParseGoldLlmJsonReport): string {
  const payload = {
    ...report,
    slotAgreement: {
      ...report.slotAgreement,
      positive: serializeSlotAgreementBucket(report.slotAgreement.positive),
      negative: serializeSlotAgreementBucket(report.slotAgreement.negative),
      overall: serializeSlotAgreementBucket(report.slotAgreement.overall)
    },
    cases: report.cases.map(row => ({
      ...row,
      slotAgreement: serializeSlotAgreementResult(row.slotAgreement),
      latencyMs: row.latencyMs === null ? 'MISSING' : row.latencyMs,
      promptTokens: row.promptTokens === null ? 'MISSING' : row.promptTokens,
      completionTokens: row.completionTokens === null ? 'MISSING' : row.completionTokens,
      totalTokens: row.totalTokens === null ? 'MISSING' : row.totalTokens
    })),
    latencyMsSummary: {
      ...report.latencyMsSummary,
      p50: report.latencyMsSummary.p50 === null ? 'MISSING' : report.latencyMsSummary.p50,
      p95: report.latencyMsSummary.p95 === null ? 'MISSING' : report.latencyMsSummary.p95,
      min: report.latencyMsSummary.min === null ? 'MISSING' : report.latencyMsSummary.min,
      max: report.latencyMsSummary.max === null ? 'MISSING' : report.latencyMsSummary.max
    },
    tokensSummary: {
      ...report.tokensSummary,
      promptSum:
        report.tokensSummary.promptSum === null ? 'MISSING' : report.tokensSummary.promptSum,
      completionSum:
        report.tokensSummary.completionSum === null
          ? 'MISSING'
          : report.tokensSummary.completionSum,
      totalSum: report.tokensSummary.totalSum === null ? 'MISSING' : report.tokensSummary.totalSum
    }
  }
  return `${JSON.stringify(payload, null, 2)}\n`
}
