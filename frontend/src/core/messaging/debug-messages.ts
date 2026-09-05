/**
 * DEV 召回探针消息（仅 import.meta.env.DEV 受理）。
 * 用于本地种书签/摘录/附注语料，禁止生产路径调用。
 */

import { z } from 'zod'

import type { BackgroundMessageScope } from '@/core/messaging/constants'

export const RecallProbePersonaSchema = z.enum([
  'researcher', // 跨来源研究者（首发优先）
  'creator', // 创作者 / 设计研究者
  'developer' // 开发者 / PM
])

const seedRecallProbePayloadSchema = z.object({
  /** 要种入的画像；默认三画像全开（质量量级轮）。 */
  personas: z
    .array(RecallProbePersonaSchema)
    .min(1)
    .max(3)
    .default(['researcher', 'creator', 'developer']),
  /**
   * true：清空当前 owner 的 Memory + 清空 Chrome 书签栏下全部子树，再种语料。
   * 不经 CLEAR_LOCAL_MEMORY（避免顺带关灌库/同步）。
   */
  replace: z.boolean().default(true),
  /** 噪声书签（邻域填充；质量轮默认偏高；压力轮可至万级）。 */
  noiseBookmarkCount: z.number().int().min(0).max(15000).default(400),
  /** 噪声摘录。 */
  noiseExcerptCount: z.number().int().min(0).max(8000).default(150),
  /** 画像风味多样性书签（非精选、可含少量附注探针）。 */
  diversityBookmarkCount: z.number().int().min(0).max(12000).default(350),
  /** 画像风味多样性摘录。 */
  diversityExcerptCount: z.number().int().min(0).max(8000).default(150),
  /**
   * 书签写入 Chrome 的范围。
   * - all：精选 + 多样性 + 噪声均写 Chrome（质量轮；万级极慢）
   * - curated_only：仅精选写 Chrome；多样性/噪声直写 Memory（压力轮 ~20k）
   */
  chromeBookmarkSync: z.enum(['all', 'curated_only']).default('all'),
  /**
   * 是否对精选条调度 LLM enrichment（烧配额；质量轮默认开）。
   * 噪声 / 多样性条永不调度。
   */
  enrichCurated: z.boolean().default(true)
})

export type SeedRecallProbePayload = z.infer<typeof seedRecallProbePayloadSchema>

/** DEV：种入召回探针语料。 */
export type DevSeedRecallProbeMessage = {
  scope: BackgroundMessageScope
  type: 'DEV_SEED_RECALL_PROBE'
  payload?: Partial<SeedRecallProbePayload>
}

export type DevSeedRecallProbeResponse =
  | {
      ok: true
      persona: string[]
      bookmarkCount: number
      excerptCount: number
      diversityBookmarkCount: number
      diversityExcerptCount: number
      noiseBookmarkCount: number
      noiseExcerptCount: number
      chromeBookmarkSync: 'all' | 'curated_only'
      indexRebuilt: boolean
      wipedChromeFolders: number
      clearedMemoryCount: number
      probeKeys: string[]
    }
  | {
      ok: false
      errorCode: 'DEV_ONLY' | 'DEV_SEED_FAILED' // DEV_ONLY=生产构建拒绝；DEV_SEED_FAILED=种入异常
      error?: string
    }

/** DEV：清除探针噪声 / 多样性层（保留精选语料）。 */
export type DevPurgeProbeNoiseMessage = {
  scope: BackgroundMessageScope
  type: 'DEV_PURGE_PROBE_NOISE'
}

export type DevPurgeProbeNoiseResponse =
  | {
      ok: true
      scannedCount: number
      purgedExcerptCount: number
      purgedBookmarkCount: number
      detachedCuratedBookmarkCount: number
      removedChromeProbeFolder: boolean
      removedChromeBookmarkNodes: number
      keptCount: number
      indexRebuilt: boolean
    }
  | {
      ok: false
      errorCode: 'DEV_ONLY' | 'DEV_PURGE_FAILED' // DEV_ONLY=生产构建拒绝；DEV_PURGE_FAILED=清除异常
      error?: string
    }

const backdateMemorySavedAtPayloadSchema = z
  .object({
    ids: z.array(z.string().uuid()).min(1).max(100),
    /** 相对今天 UTC 正午回溯天数；与 savedAtIso 二选一 */
    daysAgo: z.number().int().min(0).max(3650).optional(),
    /** 绝对 ISO datetime；与 daysAgo 二选一 */
    savedAtIso: z.string().datetime().optional()
  })
  .refine(
    value =>
      (value.daysAgo !== undefined && value.savedAtIso === undefined) ||
      (value.daysAgo === undefined && value.savedAtIso !== undefined),
    { message: '须指定 daysAgo 或 savedAtIso 之一，且不可同时指定' }
  )

export type BackdateMemorySavedAtPayload = z.infer<typeof backdateMemorySavedAtPayloadSchema>

/** DEV：回溯 MemoryItem 保存时刻（TTE 冷却手测）。 */
export type DevBackdateMemorySavedAtMessage = {
  scope: BackgroundMessageScope
  type: 'DEV_BACKDATE_MEMORY_SAVED_AT'
  payload: BackdateMemorySavedAtPayload
}

export type DevBackdateMemorySavedAtResponse =
  | {
      ok: true
      savedAtIso: string
      updated: Array<{ id: string; type: string; savedAtIso: string }>
      notFound: string[]
    }
  | {
      ok: false
      errorCode: 'DEV_ONLY' | 'DEV_BACKDATE_FAILED'
      error?: string
    }

export type DebugBackgroundMessage =
  | DevSeedRecallProbeMessage
  | DevPurgeProbeNoiseMessage
  | DevBackdateMemorySavedAtMessage
export type DebugBackgroundResponse =
  | DevSeedRecallProbeResponse
  | DevPurgeProbeNoiseResponse
  | DevBackdateMemorySavedAtResponse

export function parseSeedRecallProbePayload(value: unknown): SeedRecallProbePayload {
  return seedRecallProbePayloadSchema.parse(value ?? {})
}

export function parseBackdateMemorySavedAtPayload(value: unknown): BackdateMemorySavedAtPayload {
  return backdateMemorySavedAtPayloadSchema.parse(value)
}
