import { z } from 'zod'

import type { BehaviorHistoryImportState } from '@/core/behavior/behavior-history-import-state'
import type { BookmarkLibraryIndex } from '@/core/memory/bookmark-library-index'
import type { ChromeBookmarkImportState } from '@/core/memory/chrome-bookmark-import-state'
import type { ColdStartEnrichmentBatch } from '@/core/memory/cold-start-enrichment-batch'
import type { ColdStartPipelineState } from '@/core/memory/cold-start-pipeline-state'
import type { LocalMemoryImportErrorCode } from '@/core/memory/local-memory-import-error'
import type { ThirdPartyCorpusImportErrorCodeSchema } from '@/core/memory/third-party-corpus-import-state'
import { type ThirdPartyCorpusImportState } from '@/core/memory/third-party-corpus-import-state'
import { ThirdPartyCorpusSourceSchema } from '@/core/memory/third-party-corpus-source'
import type { BackgroundMessageScope } from '@/core/messaging/constants'

/** Import / 书签树面向 UI 的稳定错误码。 */
export const ImportErrorCodeSchema = z.enum([
  'IMPORT_STATUS_READ_FAILED', // 读取导入状态失败
  'LIBRARY_TREE_READ_FAILED', // 读取书签树失败
  'COLD_START_STATUS_READ_FAILED', // 读取冷启动门禁状态失败
  'GS_CLUE_SAMPLES_FAILED', // Getting Started 示意 clue 生成失败
  'BEHAVIOR_IMPORT_STATUS_READ_FAILED', // 读取浏览记录导入状态失败
  'BEHAVIOR_IMPORT_START_FAILED', // 启动浏览记录导入失败
  'BEHAVIOR_CLEAR_FAILED' // 清除行为数据失败
])

export type ImportErrorCode = z.infer<typeof ImportErrorCodeSchema>

/** 查询 Chrome 书签导入进度。 */
export type GetChromeBookmarkImportStatusMessage = {
  scope: BackgroundMessageScope
  type: 'GET_CHROME_BOOKMARK_IMPORT_STATUS'
}

/** 重新跑 Chrome 书签一次性导入 / ensure（Settings「重新导入」）。 */
export type EnsureChromeBookmarksImportedMessage = {
  scope: BackgroundMessageScope
  type: 'ENSURE_CHROME_BOOKMARKS_IMPORTED'
}

/** 查询浏览记录导入进度。 */
export type GetBehaviorHistoryImportStatusMessage = {
  scope: BackgroundMessageScope
  type: 'GET_BEHAVIOR_HISTORY_IMPORT_STATUS'
}

/** 启动浏览记录一次性导入（含可选 history 权限请求）。 */
export type ImportBehaviorHistoryMessage = {
  scope: BackgroundMessageScope
  type: 'IMPORT_BEHAVIOR_HISTORY'
}

/** 清除当前 owner 行为统计 + 导入状态。 */
export type ClearBehaviorHistoryMessage = {
  scope: BackgroundMessageScope
  type: 'CLEAR_BEHAVIOR_HISTORY'
}

export type BehaviorHistoryImportStatusSuccessResponse = {
  ok: true
  state: BehaviorHistoryImportState | null
}

export type BehaviorHistoryImportStatusErrorResponse = {
  ok: false
  errorCode: ImportErrorCode
  error?: string
}

export type BehaviorHistoryImportStatusResponse =
  BehaviorHistoryImportStatusSuccessResponse | BehaviorHistoryImportStatusErrorResponse

export type ImportBehaviorHistorySuccessResponse = {
  ok: true
  state: BehaviorHistoryImportState
}

export type ImportBehaviorHistoryErrorResponse = {
  ok: false
  errorCode: ImportErrorCode
  error?: string
}

export type ImportBehaviorHistoryResponse =
  ImportBehaviorHistorySuccessResponse | ImportBehaviorHistoryErrorResponse

export type ClearBehaviorHistorySuccessResponse = {
  ok: true
  deleted: number
}

export type ClearBehaviorHistoryErrorResponse = {
  ok: false
  errorCode: ImportErrorCode
  error?: string
}

export type ClearBehaviorHistoryResponse =
  ClearBehaviorHistorySuccessResponse | ClearBehaviorHistoryErrorResponse

export type EnsureChromeBookmarksImportedSuccessResponse = {
  ok: true
  state: ChromeBookmarkImportState
}

export type EnsureChromeBookmarksImportedErrorResponse = {
  ok: false
  errorCode: ImportErrorCode
  error?: string
}

export type EnsureChromeBookmarksImportedResponse =
  EnsureChromeBookmarksImportedSuccessResponse | EnsureChromeBookmarksImportedErrorResponse

export type ChromeBookmarkImportStatusSuccessResponse = {
  ok: true
  state: ChromeBookmarkImportState | null
}

export type ChromeBookmarkImportStatusErrorResponse = {
  ok: false
  errorCode: ImportErrorCode
  error?: string
}

export type ChromeBookmarkImportStatusResponse =
  ChromeBookmarkImportStatusSuccessResponse | ChromeBookmarkImportStatusErrorResponse

/** 读取记忆库用的 Chrome 书签目录树（只读）。 */
export type GetBookmarkLibraryTreeMessage = {
  scope: BackgroundMessageScope
  type: 'GET_BOOKMARK_LIBRARY_TREE'
  payload?: {
    /** UI 缓存的结构 hash；一致时 SW 可返回 unchanged。 */
    clientHash?: string
  }
}

export type GetBookmarkLibraryTreeUnchangedResponse = {
  ok: true
  unchanged: true
  structureHash: string
  bookmarkCount: number
  /** 全量导入已完成时才应展示「未同步」标记。 */
  syncReady: boolean
}

export type GetBookmarkLibraryTreeDataResponse = {
  ok: true
  index: BookmarkLibraryIndex
  structureHash: string
  bookmarkCount: number
  syncReady: boolean
}

export type GetBookmarkLibraryTreeSuccessResponse =
  GetBookmarkLibraryTreeUnchangedResponse | GetBookmarkLibraryTreeDataResponse

export type GetBookmarkLibraryTreeErrorResponse = {
  ok: false
  errorCode: ImportErrorCode
  error?: string
}

export type GetBookmarkLibraryTreeResponse =
  GetBookmarkLibraryTreeSuccessResponse | GetBookmarkLibraryTreeErrorResponse

/** 查询冷启动三阶段门禁进度。 */
export type GetColdStartStatusMessage = {
  scope: BackgroundMessageScope
  type: 'GET_COLD_START_STATUS'
}

export type ColdStartStatusSuccessResponse = {
  ok: true
  state: ColdStartPipelineState | null
  /** 本轮冷启动 LLM enrichment 批次进度（无则 null）。 */
  enrichmentBatch: ColdStartEnrichmentBatch | null
}

export type ColdStartStatusErrorResponse = {
  ok: false
  errorCode: ImportErrorCode
  error?: string
}

export type ColdStartStatusResponse = ColdStartStatusSuccessResponse | ColdStartStatusErrorResponse

const generateGettingStartedClueSamplesPayloadSchema = z
  .object({
    /** 无书签时的英文兜底口语（由 UI t() 注入） */
    fallbackClue: z.string().trim().min(1).max(200).optional()
  })
  .strict()

/** 生成 Getting Started 示意 clue（LLM 一次 4 条；失败回退模板）。 */
export type GenerateGettingStartedClueSamplesMessage = {
  scope: BackgroundMessageScope
  type: 'GENERATE_GETTING_STARTED_CLUE_SAMPLES'
  payload?: z.infer<typeof generateGettingStartedClueSamplesPayloadSchema>
}

export type GenerateGettingStartedClueSamplesSuccessResponse = {
  ok: true
  clues: string[]
  /** llm：Worker；template：标题模板 */
  origin: 'llm' | 'template'
  chromeId: string
  title: string
  url?: string
  fromCache: boolean
}

export type GenerateGettingStartedClueSamplesErrorResponse = {
  ok: false
  errorCode: ImportErrorCode
  error?: string
}

export type GenerateGettingStartedClueSamplesResponse =
  GenerateGettingStartedClueSamplesSuccessResponse | GenerateGettingStartedClueSamplesErrorResponse

const importThirdPartyCorpusPayloadSchema = z.object({
  source: ThirdPartyCorpusSourceSchema,
  content: z.string().min(1).max(5_000_000),
  format: z.enum(['html', 'csv', 'json']).optional()
})

/** 导入 Raindrop / Pocket 导出文件（§5.10.6）。 */
export type ImportThirdPartyCorpusMessage = {
  scope: BackgroundMessageScope
  type: 'IMPORT_THIRD_PARTY_CORPUS'
  payload: z.infer<typeof importThirdPartyCorpusPayloadSchema>
}

export type ImportThirdPartyCorpusSuccessResponse = {
  ok: true
  importedCount: number
}

export type ImportThirdPartyCorpusErrorResponse = {
  ok: false
  errorCode: z.infer<typeof ThirdPartyCorpusImportErrorCodeSchema>
  error?: string
}

export type ImportThirdPartyCorpusResponse =
  ImportThirdPartyCorpusSuccessResponse | ImportThirdPartyCorpusErrorResponse

/** Chrome sendMessage 上限 64MiB；50M 字符对典型 Backup JSON 安全。 */
const importLocalMemoryPayloadSchema = z.object({
  content: z.string().min(1).max(50_000_000)
})

/** 恢复本地 Backup JSON（含 L3 · Settings「数据与隐私」）。 */
export type ImportLocalMemoryMessage = {
  scope: BackgroundMessageScope
  type: 'IMPORT_LOCAL_MEMORY'
  payload: z.infer<typeof importLocalMemoryPayloadSchema>
}

export type ImportLocalMemorySuccessResponse = {
  ok: true
  restoredItems: number
  skippedItems: number
  restoredNotes: number
  skippedNotes: number
}

export type ImportLocalMemoryErrorResponse = {
  ok: false
  errorCode: LocalMemoryImportErrorCode
  error?: string
}

export type ImportLocalMemoryResponse =
  ImportLocalMemorySuccessResponse | ImportLocalMemoryErrorResponse

/** 单来源摘要（条数 + 最近导入状态）。 */
export type ThirdPartyCorpusSourceSummaryPayload = {
  count: number
  lastImport: ThirdPartyCorpusImportState | null
}

/** 查询两来源第三方语料条数与最近导入状态。 */
export type GetThirdPartyCorpusSummaryMessage = {
  scope: BackgroundMessageScope
  type: 'GET_THIRD_PARTY_CORPUS_SUMMARY'
}

/**
 * 查询 Chrome 未同步进库的书签叶子数（同步关 + 导入已完成时）。
 * 只计数，不 upsert；面板打开时 cold-start 探针调用一次。
 */
export type GetBookmarkSyncStalenessMessage = {
  scope: BackgroundMessageScope
  type: 'GET_BOOKMARK_SYNC_STALENESS'
}

export type BookmarkSyncStalenessSuccessResponse = {
  ok: true
  unsyncedCount: number
}

export type BookmarkSyncStalenessErrorResponse = {
  ok: false
  errorCode: ImportErrorCode
  error?: string
}

export type BookmarkSyncStalenessResponse =
  BookmarkSyncStalenessSuccessResponse | BookmarkSyncStalenessErrorResponse

export type ThirdPartyCorpusSummarySuccessResponse = {
  ok: true
  sources: {
    raindrop: ThirdPartyCorpusSourceSummaryPayload
    pocket: ThirdPartyCorpusSourceSummaryPayload
  }
}

export type ThirdPartyCorpusSummaryErrorResponse = {
  ok: false
  errorCode: ImportErrorCode
  error?: string
}

export type ThirdPartyCorpusSummaryResponse =
  ThirdPartyCorpusSummarySuccessResponse | ThirdPartyCorpusSummaryErrorResponse

const deleteThirdPartyCorpusBySourcePayloadSchema = z.object({
  source: ThirdPartyCorpusSourceSchema
})

/** 按来源硬删全部第三方导入副本。 */
export type DeleteThirdPartyCorpusBySourceMessage = {
  scope: BackgroundMessageScope
  type: 'DELETE_THIRD_PARTY_CORPUS_BY_SOURCE'
  payload: z.infer<typeof deleteThirdPartyCorpusBySourcePayloadSchema>
}

export type DeleteThirdPartyCorpusBySourceSuccessResponse = {
  ok: true
  deletedCount: number
}

export type DeleteThirdPartyCorpusBySourceErrorResponse = {
  ok: false
  errorCode: ImportErrorCode
  error?: string
}

export type DeleteThirdPartyCorpusBySourceResponse =
  DeleteThirdPartyCorpusBySourceSuccessResponse | DeleteThirdPartyCorpusBySourceErrorResponse

export type ImportBackgroundMessage =
  | GetChromeBookmarkImportStatusMessage
  | EnsureChromeBookmarksImportedMessage
  | GetBehaviorHistoryImportStatusMessage
  | ImportBehaviorHistoryMessage
  | ClearBehaviorHistoryMessage
  | GetBookmarkLibraryTreeMessage
  | GetColdStartStatusMessage
  | GenerateGettingStartedClueSamplesMessage
  | ImportThirdPartyCorpusMessage
  | ImportLocalMemoryMessage
  | GetThirdPartyCorpusSummaryMessage
  | GetBookmarkSyncStalenessMessage
  | DeleteThirdPartyCorpusBySourceMessage

export type ImportBackgroundResponse =
  | ChromeBookmarkImportStatusResponse
  | EnsureChromeBookmarksImportedResponse
  | BehaviorHistoryImportStatusResponse
  | ImportBehaviorHistoryResponse
  | ClearBehaviorHistoryResponse
  | GetBookmarkLibraryTreeResponse
  | ColdStartStatusResponse
  | GenerateGettingStartedClueSamplesResponse
  | ImportThirdPartyCorpusResponse
  | ImportLocalMemoryResponse
  | ThirdPartyCorpusSummaryResponse
  | BookmarkSyncStalenessResponse
  | DeleteThirdPartyCorpusBySourceResponse

export function parseImportThirdPartyCorpusPayload(value: unknown) {
  return importThirdPartyCorpusPayloadSchema.parse(value)
}

export function parseDeleteThirdPartyCorpusBySourcePayload(value: unknown) {
  return deleteThirdPartyCorpusBySourcePayloadSchema.parse(value)
}

export function parseImportLocalMemoryPayload(value: unknown) {
  return importLocalMemoryPayloadSchema.parse(value)
}

export function parseGenerateGettingStartedClueSamplesPayload(value: unknown): {
  fallbackClue?: string
} {
  if (value === undefined) {
    return {}
  }
  return generateGettingStartedClueSamplesPayloadSchema.parse(value) as { fallbackClue?: string }
}

const getBookmarkLibraryTreePayloadSchema = z
  .object({
    /** UI 缓存的结构 hash；一致时 SW 可返回 unchanged。 */
    clientHash: z.string().min(1).optional()
  })
  .strict()

/** 解析 GET_BOOKMARK_LIBRARY_TREE payload；非法 shape 抛 ZodError。 */
export function parseGetBookmarkLibraryTreePayload(value: unknown): {
  clientHash?: string
} {
  if (value === undefined) {
    return {}
  }
  return getBookmarkLibraryTreePayloadSchema.parse(value) as { clientHash?: string }
}
