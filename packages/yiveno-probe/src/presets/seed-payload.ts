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
  chromeBookmarkSync?: 'all' | 'curated_only'
  enrichCurated?: boolean
  /**
   * diversity / noise 过程随机种子（可复现）。
   * 缺省由 seeder 使用 DEFAULT_PROBE_FILLER_SEED。
   */
  fillerSeed?: number
}
