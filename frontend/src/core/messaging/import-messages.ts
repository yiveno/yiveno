import { z } from 'zod'

import type { BookmarkLibraryTreeNode } from '@/core/memory/bookmark-library-tree'
import type { ChromeBookmarkImportState } from '@/core/memory/chrome-bookmark-import-state'
import type { BackgroundMessageScope } from '@/core/messaging/constants'

/** Import / 书签树面向 UI 的稳定错误码。 */
export const ImportErrorCodeSchema = z.enum([
  'IMPORT_STATUS_READ_FAILED',
  'LIBRARY_TREE_READ_FAILED'
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
}

export type GetBookmarkLibraryTreeSuccessResponse = {
  ok: true
  roots: BookmarkLibraryTreeNode[]
  bookmarkCount: number
}

export type GetBookmarkLibraryTreeErrorResponse = {
  ok: false
  errorCode: ImportErrorCode
  error?: string
}

export type GetBookmarkLibraryTreeResponse =
  | GetBookmarkLibraryTreeSuccessResponse
  | GetBookmarkLibraryTreeErrorResponse

export type ImportBackgroundMessage =
  | GetChromeBookmarkImportStatusMessage
  | GetBookmarkLibraryTreeMessage

export type ImportBackgroundResponse =
  | ChromeBookmarkImportStatusResponse
  | GetBookmarkLibraryTreeResponse
