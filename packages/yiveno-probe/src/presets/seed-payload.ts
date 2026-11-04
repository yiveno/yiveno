/**
 * 种库 payload（与扩展 DEV_SEED_RECALL_PROBE 对齐）。
 */

import type { RecallProbePersonaId } from '../corpus/types'

export type ProbeSeedPayload = {
  replace?: boolean
  personas?: RecallProbePersonaId[]
  diversityBookmarkCount?: number
  diversityExcerptCount?: number
  noiseBookmarkCount?: number
  noiseExcerptCount?: number
  /** 每画像混淆组书签组数（缺省 0） */
  clusterBookmarkCount?: number
  /** 每画像混淆组摘录组数（缺省 0） */
  clusterExcerptCount?: number
  chromeBookmarkSync?: 'all' | 'curated_only'
  enrichCurated?: boolean
  /**
   * diversity / noise / cluster 过程随机种子（可复现）。
   * 缺省由 seeder 使用 DEFAULT_PROBE_FILLER_SEED。
   */
  fillerSeed?: number
  /** 可选配方 id（写入映射 seedContext，供 runner 历史对账） */
  recipeId?: string
}
