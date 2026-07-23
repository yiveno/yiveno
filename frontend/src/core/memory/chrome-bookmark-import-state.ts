import { z } from 'zod'

/** 书签导入状态存储键。 */
export const CHROME_BOOKMARK_IMPORT_STORAGE_KEY = 'yiveno:chrome_bookmark_import' as const

export const ChromeBookmarkImportStateSchema = z.object({
  status: z.enum(['pending', 'running', 'completed', 'failed']),
  importedCount: z.number().int().nonnegative().default(0),
  /** Chrome 书签树中待导入的 http(s) 叶子总数。 */
  totalCount: z.number().int().nonnegative().optional(),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
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
