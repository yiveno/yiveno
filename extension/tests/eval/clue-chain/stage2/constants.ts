/**
 * 合成 Clue 闭环 · Stage 2 召回 harness 常量。
 * 语料规模对齐 behavior-ablation（120 / 12 簇）；种子独立，改种子=新数据集。
 */

/** 语料 / 行为 / clue 主种子（写死；报告亦记录）。 */
export const CLUE_CHAIN_STAGE2_SEED = 0xc1e2_0202

/** 固定评测时钟（与 behavior-ablation / hybrid eval 对齐）。 */
export const CLUE_CHAIN_STAGE2_NOW_MS = Date.parse('2026-07-25T12:00:00.000Z')

export const CLUE_CHAIN_STAGE2_NOW_ISO = '2026-07-25T12:00:00.000Z'

/**
 * 规模硬约束（生成器 + 单测锁）。
 * 正例：每目标 2 条 clue；三档轮转覆盖；另加 negative。
 */
export const CLUE_CHAIN_STAGE2_SIZES = {
  /** MemoryItem 条数（复用 behavior-ablation 语料生成器） */
  corpusItems: 120,
  /** 主题簇数 */
  topicClusters: 12,
  /** 每簇条目数 */
  itemsPerCluster: 10,
  /** 每目标正例 clue 数 */
  cluesPerTarget: 2,
  /** 正例总数 = corpusItems × cluesPerTarget */
  positiveTasks: 240,
  /** 负例（库中无目标） */
  negativeTasks: 24,
  /** 任务总数 */
  totalTasks: 264
} as const

/** fixture / 报告协议版本。 */
export const CLUE_CHAIN_STAGE2_DATASET_VERSION = 1

/**
 * 建议门禁阈值（首轮基线 2026-11-26 后提议；本轮不锁死）。
 * 口径：回归地板（略低于首轮实测），不是 stretch。
 * CLI / 报告可打印；compare 不据此 fail。
 *
 * 首轮实测参考：正例 R@1≈0.637 / R@5≈0.758 / MRR≈0.695；
 * concrete R@1=1.0；negative 误命中≈0.583（vague 弱、负例假命中偏高，下轮再收）。
 */
export const CLUE_CHAIN_STAGE2_SUGGESTED_GATES = {
  /** 正例整体 Recall@1 下限建议（首轮 ~0.64） */
  positiveRecallAt1Min: 0.55,
  /** 正例整体 Recall@5 下限建议（首轮 ~0.76） */
  positiveRecallAt5Min: 0.7,
  /** 正例整体 MRR 下限建议（首轮 ~0.70） */
  positiveMrrMin: 0.6,
  /** concrete 档 Recall@1 下限建议（首轮 1.0） */
  concreteRecallAt1Min: 0.9,
  /** negative 误命中率上限建议（首轮 ~0.58；先守不恶化） */
  negativeFalseHitMax: 0.65
} as const
