/**
 * Eval 失败观察（Phase A）。
 *
 * **硬区分：**
 * - `observedStage` = 根据结果位置 / 期望形态 **观察到的失败阶段**（可复现）。
 * - `inferredRootCause` = **恒为 null**：本模块不推断 Embedding / Schema / 提示词等根因。
 *
 * 禁止读法：
 * - 召回未进邻域 ≠ Embedding 坏了
 * - Schema/Zod 通过 ≠ 槽位语义正确
 * - 本观察 ≠ §5.9 / TTE 结论
 */

import { RECALL_RESULT_PAGE_SIZE } from '@/core/recall/build-recall-result'
import { assessKnownGoldRecallGap } from '@/core/recall/dual-thread'
import type {
  KnownGoldRecallGapResult,
  RecallFailureDetailCode,
  RecallFailureStage
} from '@/core/recall/dual-thread/recall-failure-attribution'
import type { RecallResult } from '@/core/recall/recall-result'

/** 观察阶段：复用暗线 stage，并加 eval 专用值。 */
export type EvalObservedFailureStage =
  | RecallFailureStage
  | 'expectation_failed' // 期望形态不符（如期望 no_match 却有结果），尚未落到金标位次观察
  | 'not_applicable' // 通过或无需观察

export interface EvalFailureObservation {
  /** 观察到的失败阶段（位置 taxonomy / 期望不符）；不是根因 */
  observedStage: EvalObservedFailureStage
  /** Phase A：永不自动推断根因 */
  inferredRootCause: null
  /** 明示策略，防止日志被读成「已定位根因」 */
  rootCausePolicy: 'not_inferred'
  /** 细码（来自漏召检测或空）；不单独当根因 */
  detailCodes: RecallFailureDetailCode[]
  /** 金标是否在邻域（未知则 null） */
  inNeighborhood: boolean | null
  /** 邻域 0-based 位次；不在则为 null */
  neighborhoodRank: number | null
  /** 是否在首屏（未知则 null） */
  inFirstScreen: boolean | null
  /** 短中文说明（无私人 clue 原文义务；eval 可用 caseId 外信息） */
  summaryZh: string
  /** 防误读提示 */
  warningsZh: readonly string[]
}

const DEFAULT_WARNINGS_ZH: readonly string[] = [
  'observedStage 仅为结果位置/期望观察，不是根因',
  '不得将未进邻域直接归因于 Embedding',
  '不得将 Schema/Zod 通过等同于槽位语义正确'
]

/** 从 RecallResult 抽出展示邻域有序 id（topPick → alsoPossible）。 */
export function rankedIdsFromRecallResult(result: RecallResult | null | undefined): string[] {
  if (!result) {
    return []
  }
  const ids: string[] = []
  if (result.topPick) {
    ids.push(result.topPick.item.id)
  }
  for (const match of result.alsoPossible) {
    ids.push(match.item.id)
  }
  return ids
}

export type EvalExpectationKindForObservation = 'top1' | 'in_topk' | 'need_a_clue' | 'no_match'

export interface ObserveEvalFailureInput {
  /** 用例是否已判定失败；通过则返回 not_applicable */
  passed: boolean
  expectationKind: EvalExpectationKindForObservation
  /** 有金标 id 时做位次观察；no_match 期望可省略 */
  expectedId?: string
  result: RecallResult | null
  /**
   * 金标是否在本轮 corpus 内。
   * eval 合成库默认 true（有 expectedId 时）；未知可传 false 仅当故意测未入库。
   */
  goldInLibrary?: boolean
  /** 首屏条数；默认 RECALL_RESULT_PAGE_SIZE */
  firstScreenSize?: number
}

function baseObservation(
  partial: Omit<EvalFailureObservation, 'inferredRootCause' | 'rootCausePolicy' | 'warningsZh'> & {
    warningsZh?: readonly string[]
  }
): EvalFailureObservation {
  return {
    ...partial,
    inferredRootCause: null,
    rootCausePolicy: 'not_inferred',
    warningsZh: partial.warningsZh ?? DEFAULT_WARNINGS_ZH
  }
}

function fromGoldGap(gap: KnownGoldRecallGapResult): EvalFailureObservation {
  return baseObservation({
    observedStage: gap.stage,
    detailCodes: [...gap.detailCodes],
    inNeighborhood: gap.inNeighborhood,
    neighborhoodRank: gap.rank,
    inFirstScreen: gap.inFirstScreen,
    summaryZh: gap.summaryZh
  })
}

/**
 * 对单条失败用例生成观察记录。
 *
 * - **不**传入 `candidateIds`：避免 `assessKnownGoldRecallGap` 在「候选未知」时贴上 `weak_index`，
 *   从而被误读成 Embedding/倒排根因。
 * - 期望 `no_match` 且失败：只标 `expectation_failed`，不做金标位次归因。
 */
export function observeEvalFailure(input: ObserveEvalFailureInput): EvalFailureObservation {
  if (input.passed) {
    return baseObservation({
      observedStage: 'not_applicable',
      detailCodes: [],
      inNeighborhood: null,
      neighborhoodRank: null,
      inFirstScreen: null,
      summaryZh: '用例通过，无失败观察'
    })
  }

  if (input.expectationKind === 'no_match') {
    const outcome = input.result?.outcome ?? 'null_result'
    return baseObservation({
      observedStage: 'expectation_failed',
      detailCodes: [],
      inNeighborhood: null,
      neighborhoodRank: null,
      inFirstScreen: null,
      summaryZh: `期望 no_match，实际 outcome=${outcome}（未做金标位次归因，亦未推断根因）`
    })
  }

  const expectedId = input.expectedId?.trim() ?? ''
  if (!expectedId) {
    return baseObservation({
      observedStage: 'unknown',
      detailCodes: [],
      inNeighborhood: null,
      neighborhoodRank: null,
      inFirstScreen: null,
      summaryZh: '失败但无 expectedId，无法做金标位次观察'
    })
  }

  const neighborhoodIds = rankedIdsFromRecallResult(input.result)
  const goldInLibrary = input.goldInLibrary ?? true
  const gap = assessKnownGoldRecallGap({
    goldId: expectedId,
    goldInLibrary,
    neighborhoodIds,
    firstScreenSize: input.firstScreenSize ?? RECALL_RESULT_PAGE_SIZE
    // 故意不传 candidateIds → 不触发 weak_index 细码
  })

  // 期望 top1 但金标已在首屏（含非首位）：漏召检测会给 unknown；补一句观察说明
  if (input.expectationKind === 'top1' && gap.inFirstScreen && gap.rank !== null && gap.rank > 0) {
    return baseObservation({
      observedStage: 'rank_wrong',
      detailCodes: ['rank_wrong'],
      inNeighborhood: true,
      neighborhoodRank: gap.rank,
      inFirstScreen: true,
      summaryZh: `期望 Top1，金标在邻域第 ${gap.rank + 1} 位（仍在首屏）→ 观察为排序/头名问题，根因未推断`
    })
  }

  if (input.expectationKind === 'top1' && gap.rank === 0 && gap.inFirstScreen) {
    // 金标已是邻域首位但仍判失败（例如 outcome 不是 top_pick）
    return baseObservation({
      observedStage: 'expectation_failed',
      detailCodes: [],
      inNeighborhood: true,
      neighborhoodRank: 0,
      inFirstScreen: true,
      summaryZh: `金标已在邻域首位，但期望形态未满足（outcome=${input.result?.outcome ?? 'null'}）；根因未推断`
    })
  }

  return fromGoldGap(gap)
}

/** 单行日志摘要（供 stretch / 调试 console）。 */
export function formatEvalFailureObservationLine(
  caseId: string,
  observation: EvalFailureObservation
): string {
  const rank = observation.neighborhoodRank === null ? 'n/a' : String(observation.neighborhoodRank)
  return (
    `${caseId}: observedStage=${observation.observedStage}` +
    ` rank0=${rank}` +
    ` rootCause=not_inferred` +
    ` | ${observation.summaryZh}`
  )
}
