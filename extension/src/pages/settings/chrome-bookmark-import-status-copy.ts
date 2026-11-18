import type { ChromeBookmarkImportErrorCode } from '@/core/memory/chrome-bookmark-import-state'
import type { ChromeBookmarkImportState } from '@/core/memory/chrome-bookmark-import-state'
import type { ImportErrorCode } from '@/core/messaging/import-messages'

/** Chrome 书签导入状态 → Settings 展示 view（文案由 composable 渲染）。 */
export type ChromeBookmarkImportStatusView =
  | { kind: 'none' } // 查询成功且 state 为 null：从未导入，不显示状态行
  | { kind: 'query_failed'; errorCode: ImportErrorCode | null }
  | { kind: 'running'; importedCount: number; totalCount: number | null }
  | { kind: 'completed'; importedCount: number }
  | { kind: 'failed'; errorCode: ChromeBookmarkImportErrorCode | null }

/**
 * 将导入 state / 查询结果解析为 Settings 状态行 view。
 * queryOk === false 优先；state null → none；pending/running → running。
 */
export function resolveChromeBookmarkImportStatusView(
  state: ChromeBookmarkImportState | null,
  queryOk: boolean,
  errorCode?: ImportErrorCode
): ChromeBookmarkImportStatusView {
  if (!queryOk) {
    return { kind: 'query_failed', errorCode: errorCode ?? null }
  }
  if (state == null) {
    return { kind: 'none' }
  }
  if (state.status === 'running' || state.status === 'pending') {
    const total = state.totalCount == null || state.totalCount <= 0 ? null : state.totalCount
    return {
      kind: 'running',
      importedCount: state.importedCount,
      totalCount: total
    }
  }
  if (state.status === 'completed') {
    return { kind: 'completed', importedCount: state.importedCount }
  }
  return { kind: 'failed', errorCode: state.errorCode ?? null }
}
