import { getChromeBookmarkImportStatus } from '@/application/capture/import-chrome-bookmarks-service'
import type { ChromeBookmarkImportStatusResponse } from '@/core/messaging/import-messages'
import { logger } from '@/infrastructure/logging/logger'

/** 返回 Chrome 书签导入进度。 */
export async function handleGetChromeBookmarkImportStatus(): Promise<ChromeBookmarkImportStatusResponse> {
  try {
    const state = await getChromeBookmarkImportStatus()
    return { ok: true, state }
  } catch (error) {
    logger.error('Background', '读取书签导入状态失败', error)
    return {
      ok: false,
      error: error instanceof Error ? error.message : '读取书签导入状态失败'
    }
  }
}
