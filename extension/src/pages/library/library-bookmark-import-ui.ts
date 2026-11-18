import type { ChromeBookmarkImportState } from '@/core/memory/chrome-bookmark-import-state'

/** Library 书签 Tab：导入进行中（与 Getting Started consentUiPhase 同一谓词；不用 syncReady 反义）。 */
export function isLibraryBookmarkImporting(
  status: ChromeBookmarkImportState['status'] | null | undefined
): boolean {
  return status === 'running' || status === 'pending'
}

/** Library 书签 Tab：导入失败（与 importing 互斥；用于失败面板/横幅）。 */
export function isLibraryBookmarkImportFailed(
  status: ChromeBookmarkImportState['status'] | null | undefined
): boolean {
  return status === 'failed'
}

/**
 * Library「重新导入」是否应拦在发 ENSURE 之前。
 * `undefined` = 设置读取失败 → fail-open（不拦）。
 * 不自动开 ingest（ADR-024）；只归因到知情同意门关闭。
 */
export function resolveLibraryBookmarkRetryBlockedReason(
  ingestEnabled: boolean | undefined
): 'ingest_off' | null {
  if (ingestEnabled === false) {
    return 'ingest_off'
  }
  return null
}
