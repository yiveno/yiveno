import type { ChromeBookmarkImportState } from '@/core/memory/chrome-bookmark-import-state'
import type { BackgroundMessageScope } from '@/core/messaging/constants'

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
  error: string
}

export type ChromeBookmarkImportStatusResponse =
  | ChromeBookmarkImportStatusSuccessResponse
  | ChromeBookmarkImportStatusErrorResponse

export type ImportBackgroundMessage = GetChromeBookmarkImportStatusMessage

export type ImportBackgroundResponse = ChromeBookmarkImportStatusResponse
