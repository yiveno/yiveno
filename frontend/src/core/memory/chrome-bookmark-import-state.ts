import { z } from 'zod'

/** 书签导入状态存储键。 */
export const CHROME_BOOKMARK_IMPORT_STORAGE_KEY = 'yiveno:chrome_bookmark_import' as const

/** 书签导入失败面向 UI 的稳定错误码。 */
export const ChromeBookmarkImportErrorCodeSchema = z.enum([
  'BOOKMARK_IMPORT_FAILED' // 书签导入失败
])

export const ChromeBookmarkImportStateSchema = z.object({
  status: z.enum([
    'pending', // 待开始
    'running', // 进行中
    'completed', // 已完成
    'failed' // 失败
  ]),
  importedCount: z.number().int().nonnegative().default(0),
  /** Chrome 书签树中待导入的 http(s) 叶子总数。 */
  totalCount: z.number().int().nonnegative().optional(),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
  /** 失败时的稳定错误码；UI 经 t() 渲染。 */
  errorCode: ChromeBookmarkImportErrorCodeSchema.optional(),
  /** 调试用；UI 不得作为主文案。 */
  error: z.string().optional()
})

export type ChromeBookmarkImportState = z.infer<typeof ChromeBookmarkImportStateSchema>

/** 计算导入进度百分比（0–100）。 */
export function getChromeBookmarkImportPercent(state: ChromeBookmarkImportState): number {
  if (state.status === 'completed') {
    return 100
  }
  if (!state.totalCount || state.totalCount <= 0) {
    return state.status === 'running' ? 0 : 0
  }
  return Math.min(100, Math.round((state.importedCount / state.totalCount) * 100))
}
