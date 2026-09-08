/**
 * 测试数据配方（可序列化、可回放）。
 * 工作台目标 1：把测试数据组成控住——参数明确、可保存、可对照。
 */

import type { ProbeSeedPayload } from '../presets/seed-payload'
import type { RecallProbePersonaId } from '../corpus/types'

/** 配方 schema 版本。 */
export const PROBE_DATA_RECIPE_VERSION = 1 as const

export type ProbeDataRecipeSource = 'builtin' | 'custom' // builtin=内置；custom=本机保存/导入

/**
 * 一份可回放的种库配方。
 * `seed` 与扩展 DEV_SEED_RECALL_PROBE payload 对齐。
 */
export type ProbeDataRecipe = {
  version: typeof PROBE_DATA_RECIPE_VERSION
  id: string
  label: string
  hint: string
  source: ProbeDataRecipeSource
  seed: ProbeSeedPayload
  /**
   * 可选：只期望这些精选 key（对拍/盘点对照用）。
   * 当前 seeder 仍种全画像精选；本字段用于评审期望，不截断写入。
   */
  curatedKeys?: string[]
  notes?: string
  updatedAtIso?: string
}

/** 种库成功响应用于对照的最小字段。 */
export type ProbeSeedResultCounts = {
  persona: string[]
  bookmarkCount: number
  excerptCount: number
  diversityBookmarkCount: number
  diversityExcerptCount: number
  noiseBookmarkCount: number
  noiseExcerptCount: number
  chromeBookmarkSync: 'all' | 'curated_only'
  probeKeys: string[]
}

export type ProbeRecipeCompareRow = {
  field: string
  expected: string | number
  actual: string | number
  ok: boolean
}

export type ProbeRecipeCompareReport = {
  recipeId: string
  recipeLabel: string
  ok: boolean
  rows: ProbeRecipeCompareRow[]
}

export type ProbeRecipeFormState = {
  personas: RecallProbePersonaId[]
  replace: boolean
  diversityBookmarkCount: number
  diversityExcerptCount: number
  noiseBookmarkCount: number
  noiseExcerptCount: number
  chromeBookmarkSync: 'all' | 'curated_only'
  enrichCurated: boolean
  /** diversity / noise 过程随机种子 */
  fillerSeed: number
}
