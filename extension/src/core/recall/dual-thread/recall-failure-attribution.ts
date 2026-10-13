/**
 * 暗线 · Recall 失败环节归因（双线程基建）。
 * 纯 schema + 辅助映射；不自动判定根因、无 Chrome 依赖。
 *
 * 权威说明：docs/engineering/暗线基建-失败归因与受控适应.md
 */

import { z } from 'zod'

/** 失败发生在流水线的哪一阶段（主因一档）。 */
export const RecallFailureStageSchema = z.enum([
  'not_captured', // 目标未进库（未 Capture / 未同步）
  'index_gap', // 索引或 embedding 缺口
  'candidate_miss', // 库有但未进候选 / 邻域
  'understand_skew', // 理解 / 解析 / 主题门偏离
  'rank_wrong', // 进邻域但排序噪声或错排
  'clue_insufficient', // 线索过薄，不足以区分
  'absent_honest', // 诚实无相关终局
  'ux_friction', // 体验摩擦导致放弃
  'unknown' // 证据不足，禁止硬贴
])

export type RecallFailureStage = z.infer<typeof RecallFailureStageSchema>

/**
 * 细码（可多选）——兼容历史采样 taxonomy，不单独当主因。
 * 未知细码允许进 `other` 自由短串时走 detailNotes，不扩开放 enum。
 */
export const RecallFailureDetailCodeSchema = z.enum([
  'no_signal', // 库侧无对应条目
  'weak_index', // 缺向量 / 弱倒排
  'miss_neighborhood', // 邻域未含 gold
  'parse_fail', // 解析失败或槽位错
  'gist_mismatch', // 口语 gist 与条目词面鸿沟
  'missing_topic', // 无主题锚未进检索
  'rank_wrong', // 排序噪声（细码与 stage 同名时表示排序子因）
  'hybrid_drift', // Hybrid 语义漂
  'clue_thin', // 线索过泛
  'time_soft_ok', // 时间分层表现正常（旁注，非失败）
  'type_hard_empty', // 类型硬空
  'explain_missing', // 证据卡不足
  'ux_friction', // UX 摩擦
  'user_gave_up', // 用户放弃
  'other' // 其它（配合 detailNotes）
])

export type RecallFailureDetailCode = z.infer<typeof RecallFailureDetailCodeSchema>

/** 单次归因记录（研究卡 / 离线标注；非用户 UI 必填）。 */
export const RecallFailureAttributionSchema = z.object({
  /** 主阶段（单选） */
  stage: RecallFailureStageSchema,
  /** 细码（可多） */
  detailCodes: z.array(RecallFailureDetailCodeSchema).max(12).default([]),
  /** 标注者对主阶段的信心 */
  confidence: z.enum(['high', 'medium', 'low']).default('medium'),
  /** 短备注（禁止贴私人 clue / URL；≤200） */
  detailNotes: z.string().max(200).optional(),
  /** 是否已知 gold 在库内 */
  goldInLibrary: z.boolean().optional(),
  /** 是否已知 gold 曾出现在结果邻域 */
  goldInNeighborhood: z.boolean().optional()
})

export type RecallFailureAttribution = z.infer<typeof RecallFailureAttributionSchema>

/** 历史采样细码 → 建议主阶段（启发式；人可改）。 */
const DETAIL_TO_STAGE: Partial<Record<RecallFailureDetailCode, RecallFailureStage>> = {
  no_signal: 'not_captured',
  weak_index: 'index_gap',
  miss_neighborhood: 'candidate_miss',
  parse_fail: 'understand_skew',
  gist_mismatch: 'understand_skew',
  missing_topic: 'understand_skew',
  rank_wrong: 'rank_wrong',
  hybrid_drift: 'rank_wrong',
  clue_thin: 'clue_insufficient',
  type_hard_empty: 'understand_skew',
  explain_missing: 'ux_friction',
  ux_friction: 'ux_friction',
  user_gave_up: 'ux_friction',
  other: 'unknown',
  time_soft_ok: 'unknown'
}

/**
 * 由细码提议主阶段（取第一个可映射码；否则 unknown）。
 * 仅辅助填卡，不作运行时真理。
 */
export function suggestFailureStageFromDetailCodes(
  detailCodes: readonly RecallFailureDetailCode[]
): RecallFailureStage {
  for (const code of detailCodes) {
    if (code === 'time_soft_ok') continue
    const stage = DETAIL_TO_STAGE[code]
    if (stage) return stage
  }
  return 'unknown'
}

/** 校验并归一化归因对象。 */
export function parseRecallFailureAttribution(input: unknown): RecallFailureAttribution {
  return RecallFailureAttributionSchema.parse(input)
}

/** 已知目标漏召检测输入（离线 / 研究 / eval；非用户 UI）。 */
export interface KnownGoldRecallGapInput {
  /** 金标 MemoryItem id */
  goldId: string
  /** 金标是否在本机库内（事先或事后扫描） */
  goldInLibrary: boolean
  /**
   * 本轮进入候选池的 id（若可知）。
   * 未知时省略 → 无法区分 candidate_miss vs 仅邻域裁剪。
   */
  candidateIds?: readonly string[]
  /** 折叠后对用户展示的邻域 / 结果 id（有序） */
  neighborhoodIds: readonly string[]
  /** 邻域内排名（0-based）；仅当在邻域内时有意义 */
  neighborhoodRank?: number
  /** 首屏条数上限（默认 5，对齐 RECALL_RESULT_PAGE_SIZE 心智） */
  firstScreenSize?: number
}

/** 已知目标漏召检测结果。 */
export interface KnownGoldRecallGapResult {
  /** 建议主阶段 */
  stage: RecallFailureStage
  /** 建议细码 */
  detailCodes: RecallFailureDetailCode[]
  /** 是否在候选池（未知则 null） */
  inCandidates: boolean | null
  /** 是否在邻域 */
  inNeighborhood: boolean
  /** 邻域排名（不在则为 null） */
  rank: number | null
  /** 是否在首屏 */
  inFirstScreen: boolean
  /** 短说明（中文 · 无私人内容） */
  summaryZh: string
}

/**
 * 在金标已知时，区分「未存 / 候选漏 / 邻域外 / 首屏外排序问题」。
 * 不读取库、不改运行时；供采样卡与 eval 后处理使用。
 */
export function assessKnownGoldRecallGap(input: KnownGoldRecallGapInput): KnownGoldRecallGapResult {
  const firstScreenSize = input.firstScreenSize ?? 5
  const goldId = input.goldId

  if (!input.goldInLibrary) {
    return {
      stage: 'not_captured',
      detailCodes: ['no_signal'],
      inCandidates: false,
      inNeighborhood: false,
      rank: null,
      inFirstScreen: false,
      summaryZh: '金标不在库内 → 优先查 Capture/同步，而非排序'
    }
  }

  const inCandidates = input.candidateIds === undefined ? null : input.candidateIds.includes(goldId)
  const neighIndex = input.neighborhoodIds.indexOf(goldId)
  const inNeighborhood = neighIndex >= 0
  const rank = inNeighborhood ? neighIndex : null
  const inFirstScreen = rank !== null && rank < firstScreenSize

  if (inCandidates === false) {
    return {
      stage: 'candidate_miss',
      detailCodes: ['miss_neighborhood', 'weak_index'],
      inCandidates,
      inNeighborhood: false,
      rank: null,
      inFirstScreen: false,
      summaryZh: '库有但未进候选池 → 查倒排/预过滤/类型硬空，而非只拧排序'
    }
  }

  if (!inNeighborhood) {
    return {
      stage: 'candidate_miss',
      detailCodes: ['miss_neighborhood'],
      inCandidates,
      inNeighborhood: false,
      rank: null,
      inFirstScreen: false,
      summaryZh:
        inCandidates === null
          ? '库有但未进邻域（候选池未知）→ 先补候选日志再细分'
          : '进了候选但未进展示邻域 → 查折叠/硬筛/佐证门'
    }
  }

  if (!inFirstScreen) {
    return {
      stage: 'rank_wrong',
      detailCodes: ['rank_wrong'],
      inCandidates,
      inNeighborhood: true,
      rank,
      inFirstScreen: false,
      summaryZh: `金标在邻域第 ${(rank ?? 0) + 1} 位（首屏外）→ 排序/融合问题`
    }
  }

  return {
    stage: 'unknown',
    detailCodes: [],
    inCandidates,
    inNeighborhood: true,
    rank,
    inFirstScreen: true,
    summaryZh: '金标已在首屏 → 若仍判失败，查 ECS/认错/UX，而非召回漏'
  }
}

/** 将漏召检测结果收成可 parse 的归因草稿（confidence=medium）。 */
export function attributionDraftFromGoldGap(
  gap: KnownGoldRecallGapResult
): RecallFailureAttribution {
  return parseRecallFailureAttribution({
    stage: gap.stage,
    detailCodes: gap.detailCodes,
    confidence: 'medium',
    detailNotes: gap.summaryZh.slice(0, 200),
    goldInLibrary: gap.stage !== 'not_captured',
    goldInNeighborhood: gap.inNeighborhood
  })
}
