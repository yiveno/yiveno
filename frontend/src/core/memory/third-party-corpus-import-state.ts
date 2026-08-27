import { z } from 'zod'

import { ThirdPartyCorpusSourceSchema } from '@/core/memory/third-party-corpus-source'

/** chrome.storage.local 键：第三方语料导入进度。 */
export const THIRD_PARTY_CORPUS_IMPORT_STORAGE_KEY = 'yiveno.thirdPartyCorpusImport' as const

export const ThirdPartyCorpusImportStatusSchema = z.enum([
  'pending', // 未开始
  'running', // 进行中
  'completed', // 成功
  'failed' // 失败
])

export const ThirdPartyCorpusImportStateSchema = z.object({
  status: ThirdPartyCorpusImportStatusSchema,
  source: ThirdPartyCorpusSourceSchema,
  importedCount: z.number().int().nonnegative(),
  totalCount: z.number().int().nonnegative(),
  startedAt: z.string().datetime(),
  finishedAt: z.string().datetime().optional(),
  errorCode: z.string().optional()
})

export type ThirdPartyCorpusImportState = z.infer<typeof ThirdPartyCorpusImportStateSchema>

export const ThirdPartyCorpusImportErrorCodeSchema = z.enum([
  'THIRD_PARTY_IMPORT_INVALID_FORMAT', // 无法识别导出格式
  'THIRD_PARTY_IMPORT_EMPTY', // 导出无有效条目
  'THIRD_PARTY_IMPORT_TOO_MANY_ITEMS', // 超过 50 条
  'THIRD_PARTY_IMPORT_IN_PROGRESS', // 已有导入在进行
  'THIRD_PARTY_IMPORT_FAILED' // 其它失败
])

export type ThirdPartyCorpusImportErrorCode = z.infer<typeof ThirdPartyCorpusImportErrorCodeSchema>
