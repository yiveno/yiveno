/**
 * 行为层消融 · 冻结常量（种子 / 规模 / 门槛）。
 * 跑完禁止改门槛；种子变更视为新数据集。
 */

/** 语料 / 行为 / clue 生成主种子（写死；报告亦记录）。 */
export const BEHAVIOR_ABLATION_SEED = 0xbe7a_0101

/** 任务级配对 bootstrap 种子。 */
export const BEHAVIOR_ABLATION_BOOTSTRAP_SEED = 0xbe7a_0202

/** 固定评测时钟（与 hybrid eval 对齐：2026-07-25 12:00 UTC）。 */
export const BEHAVIOR_ABLATION_NOW_MS = Date.parse('2026-07-25T12:00:00.000Z')

export const BEHAVIOR_ABLATION_NOW_ISO = '2026-07-25T12:00:00.000Z'

/** 目标规模（生成器硬约束；测试锁）。 */
export const BEHAVIOR_ABLATION_SIZES = {
  /** MemoryItem 条数 */
  corpusItems: 120,
  /** 主题簇数 */
  topicClusters: 12,
  /** 每簇条目数 */
  itemsPerCluster: 10,
  /** 主任务条数 */
  mainTasks: 100,
  /** 生产轨冲突子集 */
  conflictProd: 30,
  /** 机制轨冲突子集 */
  conflictMech: 30,
  /** bootstrap 次数 */
  bootstrapRounds: 10_000
} as const

/**
 * 冻结裁决门槛（四条全过才算站得住）。
 * ① 生产轨 ON-prod − OFF 的 R@1 ≥ +8pp 且 95% CI 下限 > 0
 * ② MRR delta ≥ +0.05
 * ③ 误打开率增幅 ≤ +2pp
 * ④ 机制轨冲突子集 R@1 delta ≥ +15pp
 */
export const BEHAVIOR_ABLATION_GATES = {
  prodR1DeltaMin: 0.08,
  prodR1CiLowerMustBePositive: true,
  prodMrrDeltaMin: 0.05,
  prodFalseOpenDeltaMax: 0.02,
  mechConflictR1DeltaMin: 0.15
} as const

/** 固定 owner / profile（eval 专用；非生产账号）。 */
export const BEHAVIOR_ABLATION_OWNER_ID = 'be7a0000-0000-4000-8000-0000000000a1'
export const BEHAVIOR_ABLATION_PROFILE_ID = 'be7a0000-0000-4000-8000-0000000000a2'

/** fixture / 报告协议版本。 */
export const BEHAVIOR_ABLATION_DATASET_VERSION = 1
