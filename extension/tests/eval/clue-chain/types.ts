/**
 * 合成 Clue 闭环 · Stage 1 解析评测类型（仅 harness；不进产品主路径）。
 */

import type {
  ParsedRecallClue,
  RecallClueConfidence,
  RecallClueIntent,
  RecallObjectType,
  RecallTimeConfidence
} from '@/core/recall/parse-recall-clue-types'

/** 测试集 category：A 主题 / B 难例 / C 非召回 / D 混合。 */
export type ClueChainCategory = 'A' | 'B' | 'C' | 'D'

/** 用例难度（测试集字段；不计分）。 */
export type ClueChainDifficulty = 'easy' | 'medium' | 'hard' | string

/**
 * 测试集 expected 槽位（与 JSON 一致）。
 * - intent：`recall` | `non_recall`（后者对齐产品 chitchat/question/instruction）
 * - type：中文描述；可含「或」候选；null = 无类型预期
 * - certainty：只记录不扣分
 */
export interface ClueChainExpected {
  intent: 'recall' | 'non_recall'
  topic: string | null
  time: string | null
  time_certainty: 'high' | 'low' | 'medium' | null
  type: string | null
  entities: string[]
  behavior: string | null
  certainty: 'high' | 'medium' | 'low'
}

/** 单条测试用例（fixture JSON 元素）。 */
export interface ClueChainCase {
  id: string
  category: ClueChainCategory
  clue: string
  expected: ClueChainExpected
  difficulty: ClueChainDifficulty
  note: string
}

/** 字段级对分结果。 */
export type ClueChainFieldScore =
  | { field: string; scored: false; reason: string }
  | { field: string; scored: true; passed: boolean; detail: string }

/** 单条评分汇总。 */
export interface ClueChainCaseScore {
  id: string
  category: ClueChainCategory
  note: string
  /** 本条是否计入「核心通过」（C 只看 intent；其余看核心字段全过）。 */
  corePassed: boolean
  fields: ClueChainFieldScore[]
  /** certainty 快照（不扣分）。 */
  certaintyRecord: {
    expected: ClueChainExpected['certainty']
    actual: RecallClueConfidence | null
  }
}

/** Runner 单条原始结果。 */
export interface ClueChainParseRunCase {
  id: string
  category: ClueChainCategory
  clue: string
  note: string
  difficulty: ClueChainDifficulty
  expected: ClueChainExpected
  /** 成功解析时的 parsed；失败为 null。 */
  parsed: ParsedRecallClue | null
  /** 理解层 source。 */
  source: string | null
  intentActual: RecallClueIntent | null
  topicTermsActual: string[]
  timeLabelActual: string | null
  timeConfidenceActual: RecallTimeConfidence | null
  objectTypesActual: RecallObjectType[]
  objectTypeOtherActual: string | null
  contentTermsActual: string[]
  excludeContentTermsActual: string[]
  confidenceActual: RecallClueConfidence | null
  durationMs: number
  attempts: number
  error: string | null
  timedOut: boolean
  skipped: boolean
}

/** Topic LLM judge 结果。 */
export interface ClueChainTopicJudgeResult {
  match: boolean
  reason: string
  raw?: string
}

export interface ClueChainPassRates {
  /** 计分条数（分母）。 */
  scored: number
  passed: number
  rate: number
}

export interface ClueChainReportSummary {
  totalCases: number
  parseOk: number
  parseFailed: number
  timedOut: number
  skipped: number
  /** 核心通过率（按 category 规则）。 */
  core: ClueChainPassRates
  intent: ClueChainPassRates
  topic: ClueChainPassRates
  /** 仅 A 类 topic。 */
  topicCategoryA: ClueChainPassRates
  /** 仅 C 类 intent。 */
  intentCategoryC: ClueChainPassRates
  time: ClueChainPassRates
  type: ClueChainPassRates
  entities: ClueChainPassRates
  /** 过关门禁：C intent=100%、A topic≥90%、整体 topic≥85%。 */
  gates: {
    intentCategoryC: boolean
    topicCategoryA: boolean
    topicOverall: boolean
    allPassed: boolean
  }
}

export interface ClueChainFailureCluster {
  key: string
  category: ClueChainCategory
  note: string
  count: number
  ids: string[]
  /** 主导失败字段。 */
  fields: string[]
}

export interface ClueChainWorstCase {
  id: string
  category: ClueChainCategory
  clue: string
  note: string
  failedFields: string[]
  details: string[]
}

/** 完整跑次报告（可存档作回归基线）。 */
export interface ClueChainParseReport {
  schemaVersion: 1
  kind: 'clue-chain-parse'
  head: string
  startedAt: string
  finishedAt: string
  fixtureFiles: string[]
  llm: {
    parseCompat: string
    parseModel: string
    judgeModel: string
    direct: true
  }
  summary: ClueChainReportSummary
  clusters: ClueChainFailureCluster[]
  worst10: ClueChainWorstCase[]
  cases: Array<{
    run: ClueChainParseRunCase
    score: ClueChainCaseScore
    topicJudge: ClueChainTopicJudgeResult | null
  }>
}

/** 基线对比 delta。 */
export interface ClueChainBaselineDelta {
  baselinePath: string
  baselineHead: string
  currentHead: string
  coreRateDelta: number
  topicRateDelta: number
  intentRateDelta: number
  newlyFailedIds: string[]
  newlyPassedIds: string[]
  degraded: boolean
}
