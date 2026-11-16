import type { ChromeBookmarkImportState } from '@/core/memory/chrome-bookmark-import-state'

/** Library 书签 Tab：导入进行中（与 Getting Started consentUiPhase 同一谓词；不用 syncReady 反义）。 */
export function isLibraryBookmarkImporting(
  status: ChromeBookmarkImportState['status'] | null | undefined
): boolean {
  return status === 'running' || status === 'pending'
}
