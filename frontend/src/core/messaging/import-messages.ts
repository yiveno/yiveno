import { z } from 'zod'

import type { BookmarkLibraryIndex } from '@/core/memory/bookmark-library-index'
import type { ChromeBookmarkImportState } from '@/core/memory/chrome-bookmark-import-state'
import type { ColdStartEnrichmentBatch } from '@/core/memory/cold-start-enrichment-batch'
import type { ColdStartPipelineState } from '@/core/memory/cold-start-pipeline-state'
import type { ThirdPartyCorpusImportErrorCodeSchema } from '@/core/memory/third-party-corpus-import-state'
import { type ThirdPartyCorpusImportState } from '@/core/memory/third-party-corpus-import-state'
import { ThirdPartyCorpusSourceSchema } from '@/core/memory/third-party-corpus-source'
import type { BackgroundMessageScope } from '@/core/messaging/constants'

/** Import / 书签树面向 UI 的稳定错误码。 */
export const ImportErrorCodeSchema = z.enum([
  'IMPORT_STATUS_READ_FAILED', // 读取导入状态失败
  'LIBRARY_TREE_READ_FAILED', // 读取书签树失败
  'COLD_START_STATUS_READ_FAILED', // 读取冷启动门禁状态失败
  'GS_CLUE_SAMPLES_FAILED' // Getting Started 示意 clue 生成失败
])

export type ImportErrorCode = z.infer<typeof ImportErrorCodeSchema>

/** 查询 Chrome 书签导入进度。 */
export type GetChromeBookmarkImportStatusMessage = {
  scope: BackgroundMessageScope
  type: 'GET_CHROME_BOOKMARK_IMPORT_STATUS'
}

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
  | ChromeBookmarkImportStatusSuccessResponse
  | ChromeBookmarkImportStatusErrorResponse

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
  | GetBookmarkLibraryTreeUnchangedResponse
  | GetBookmarkLibraryTreeDataResponse

export type GetBookmarkLibraryTreeErrorResponse = {
  ok: false
  errorCode: ImportErrorCode
  error?: string
}

export type GetBookmarkLibraryTreeResponse =
  | GetBookmarkLibraryTreeSuccessResponse
  | GetBookmarkLibraryTreeErrorResponse

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
  | GenerateGettingStartedClueSamplesSuccessResponse
  | GenerateGettingStartedClueSamplesErrorResponse

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
  | ImportThirdPartyCorpusSuccessResponse
  | ImportThirdPartyCorpusErrorResponse

/** 查询第三方语料导入进度。 */
export type GetThirdPartyCorpusImportStatusMessage = {
  scope: BackgroundMessageScope
  type: 'GET_THIRD_PARTY_CORPUS_IMPORT_STATUS'
}

export type ThirdPartyCorpusImportStatusSuccessResponse = {
  ok: true
  state: ThirdPartyCorpusImportState | null
}

export type ThirdPartyCorpusImportStatusErrorResponse = {
  ok: false
  errorCode: ImportErrorCode
  error?: string
}

export type ThirdPartyCorpusImportStatusResponse =
  | ThirdPartyCorpusImportStatusSuccessResponse
  | ThirdPartyCorpusImportStatusErrorResponse

export type ImportBackgroundMessage =
  | GetChromeBookmarkImportStatusMessage
  | GetBookmarkLibraryTreeMessage
  | GetColdStartStatusMessage
  | GenerateGettingStartedClueSamplesMessage
  | ImportThirdPartyCorpusMessage
  | GetThirdPartyCorpusImportStatusMessage

export type ImportBackgroundResponse =
  | ChromeBookmarkImportStatusResponse
  | GetBookmarkLibraryTreeResponse
  | ColdStartStatusResponse
  | GenerateGettingStartedClueSamplesResponse
  | ImportThirdPartyCorpusResponse
  | ThirdPartyCorpusImportStatusResponse

export function parseImportThirdPartyCorpusPayload(value: unknown) {
  return importThirdPartyCorpusPayloadSchema.parse(value)
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
