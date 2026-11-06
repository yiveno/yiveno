import { isCodedError } from '@/core/common/coded-error'
import { optionalProp } from '@/core/common/optional-props'
import { isChromeBookmarkIngestEnabled } from '@/application/capture/chrome-bookmark-sync-service'
import { invalidateBookmarkLibraryTreeOnChromeChange } from '@/background/handlers/import-handler'
import { invalidateBookmarkSyncAlignmentCache } from '@/application/memory/bookmark-sync-alignment-cache'
import { memoryItemService } from '@/application/memory/memory-item-service'
import { backfillMissingMemoryEmbeddings } from '@/application/memory/schedule-async-memory-embedding'
import {
  exportDetailExport,
  DetailExportError
} from '@/application/recall/export-detail-export-service'
import { getAuthSession } from '@/infrastructure/identity/auth-session-service'
import type { MemoryBackgroundResponse, MemoryErrorCode } from '@/core/messaging/memory-messages'
import {
  MemoryErrorCodeSchema,
  parseCaptureBookmarkPayload,
  parseCaptureTextExcerptPayload,
  parseDeleteMemoryItemPayload,
  parseGetMemoryItemPayload,
  parseListMemoryItemsPayload,
  parseRecordMemoryOpenPayload,
  parseRecordRecallDismissPayload,
  parseRecordRecallSettlePayload,
  parseExportDetailExportPayload,
  parseUpdateMemoryNotePayload
} from '@/core/messaging/memory-messages'
import { flashActionBadge } from '@/infrastructure/browser/action-badge'
import { isSavablePageUrl } from '@/infrastructure/browser/active-tab-reader'
import { flowFail, flowOk, flowStart, previewText } from '@/infrastructure/logging/flow-log'
import { logger } from '@/infrastructure/logging/logger'
import { bumpExcerptCaptureCount } from '@/infrastructure/storage/first-recall-onboarding-storage'
import { bumpMemoryLibraryRevision } from '@/infrastructure/storage/memory-library-revision-storage'

function resolveMemoryErrorCode(error: unknown, fallback: MemoryErrorCode): MemoryErrorCode {
  if (isCodedError(error)) {
    const parsed = MemoryErrorCodeSchema.safeParse(error.errorCode)
    if (parsed.success) {
      return parsed.data
    }
  }
  return fallback
}

function toErrorResponse(errorCode: MemoryErrorCode, error?: unknown): MemoryBackgroundResponse {
  const code = error !== undefined ? resolveMemoryErrorCode(error, errorCode) : errorCode
  if (error instanceof Error) {
    return { ok: false, errorCode: code, error: error.message }
  }
  if (typeof error === 'string' && error.length > 0) {
    return { ok: false, errorCode: code, error }
  }
  return { ok: false, errorCode: code }
}

/** 捕获 Bookmark MemoryItem。 */
export async function handleCaptureBookmark(payload: unknown): Promise<MemoryBackgroundResponse> {
  const startedAt = flowStart('Capture', '捕获书签')
  try {
    if (!(await isChromeBookmarkIngestEnabled())) {
      flowOk('Capture', '捕获书签', startedAt, {
        ok: false,
        errorCode: 'BOOKMARK_INGEST_DISABLED'
      })
      return toErrorResponse('BOOKMARK_INGEST_DISABLED')
    }
    const input = parseCaptureBookmarkPayload(payload)
    const item = await memoryItemService.captureBookmark({
      payload: {
        title: input.title,
        url: input.url,
        faviconUrl: input.faviconUrl
      },
      captureEntry: input.captureEntry ?? 'popup'
    })
    flowOk('Capture', '捕获书签', startedAt, {
      id: item.id,
      entry: input.captureEntry ?? 'popup',
      url: previewText(input.url, 120)
    })
    return { ok: true, item }
  } catch (error) {
    flowFail('Capture', '捕获书签', startedAt, error)
    return toErrorResponse('MEMORY_OPERATION_FAILED', error)
  }
}

/** 捕获 Text Excerpt MemoryItem。 */
export async function handleCaptureTextExcerpt(
  payload: unknown
): Promise<MemoryBackgroundResponse> {
  const startedAt = flowStart('Capture', '捕获摘录')
  try {
    const input = parseCaptureTextExcerptPayload(payload)
    if (!isSavablePageUrl(input.sourceUrl)) {
      flowOk('Capture', '捕获摘录', startedAt, {
        ok: false,
        errorCode: 'CAPTURE_UNSAVABLE_PAGE'
      })
      return toErrorResponse('CAPTURE_UNSAVABLE_PAGE')
    }
    const item = await memoryItemService.captureTextExcerpt({
      payload: {
        selectedText: input.selectedText,
        sourceUrl: input.sourceUrl,
        pageTitle: input.pageTitle,
        contextBefore: input.contextBefore,
        contextAfter: input.contextAfter
      },
      ...optionalProp('clues', input.note ? { note: input.note } : undefined),
      captureEntry: input.captureEntry ?? 'context_menu'
    })
    void flashActionBadge('success')
    void bumpExcerptCaptureCount().catch(error => {
      logger.warn('Capture', '摘录计数更新失败', error)
    })
    void bumpMemoryLibraryRevision().catch(error => {
      logger.warn('Capture', '库修订信号更新失败', error)
    })
    flowOk('Capture', '捕获摘录', startedAt, {
      id: item.id,
      entry: input.captureEntry ?? 'context_menu',
      textPreview: previewText(input.selectedText),
      hasNote: Boolean(input.note)
    })
    return { ok: true, item }
  } catch (error) {
    flowFail('Capture', '捕获摘录', startedAt, error)
    void flashActionBadge('error')
    return toErrorResponse('MEMORY_OPERATION_FAILED', error)
  }
}

/** 列出当前用户的 MemoryItem。 */
export async function handleListMemoryItems(payload: unknown): Promise<MemoryBackgroundResponse> {
  const startedAt = flowStart('Memory', '列出条目')
  try {
    const options = parseListMemoryItemsPayload(payload)
    const items = await memoryItemService.list({
      ...optionalProp('type', options?.type),
      ...optionalProp('limit', options?.limit)
    })
    flowOk('Memory', '列出条目', startedAt, {
      count: items.length,
      type: options?.type ?? null,
      limit: options?.limit ?? null
    })
    return { ok: true, items, total: items.length }
  } catch (error) {
    flowFail('Memory', '列出条目', startedAt, error)
    return toErrorResponse('MEMORY_OPERATION_FAILED', error)
  }
}

/** 按 id 读取 MemoryItem。 */
export async function handleGetMemoryItem(payload: unknown): Promise<MemoryBackgroundResponse> {
  const startedAt = flowStart('Memory', '读取条目')
  try {
    const input = parseGetMemoryItemPayload(payload)
    const item = await memoryItemService.getById(input.id)
    if (!item) {
      flowOk('Memory', '读取条目', startedAt, { id: input.id, found: false })
      return toErrorResponse('MEMORY_NOT_FOUND')
    }
    flowOk('Memory', '读取条目', startedAt, { id: item.id, type: item.type, found: true })
    return { ok: true, item }
  } catch (error) {
    flowFail('Memory', '读取条目', startedAt, error)
    return toErrorResponse('MEMORY_OPERATION_FAILED', error)
  }
}

/** 软删 MemoryItem（仅允许 text_excerpt）。 */
export async function handleDeleteMemoryItem(payload: unknown): Promise<MemoryBackgroundResponse> {
  const startedAt = flowStart('Memory', '删除条目')
  try {
    const input = parseDeleteMemoryItemPayload(payload)
    const existing = await memoryItemService.getById(input.id)
    if (!existing) {
      flowOk('Memory', '删除条目', startedAt, { id: input.id, found: false })
      return toErrorResponse('MEMORY_NOT_FOUND')
    }
    if (existing.type !== 'text_excerpt') {
      flowOk('Memory', '删除条目', startedAt, {
        id: input.id,
        errorCode: 'MEMORY_DELETE_BOOKMARK_FORBIDDEN'
      })
      return toErrorResponse('MEMORY_DELETE_BOOKMARK_FORBIDDEN')
    }

    const item = await memoryItemService.softDelete(input.id)
    if (!item) {
      flowOk('Memory', '删除条目', startedAt, { id: input.id, found: false })
      return toErrorResponse('MEMORY_NOT_FOUND')
    }
    void bumpMemoryLibraryRevision().catch(error => {
      logger.warn('Memory', '库修订信号更新失败', error)
    })
    flowOk('Memory', '删除条目', startedAt, { id: item.id })
    return { ok: true, item }
  } catch (error) {
    flowFail('Memory', '删除条目', startedAt, error)
    return toErrorResponse('MEMORY_OPERATION_FAILED', error)
  }
}

/** 更新 clues.note（书签/摘录事后补注）。 */
export async function handleUpdateMemoryNote(payload: unknown): Promise<MemoryBackgroundResponse> {
  const startedAt = flowStart('Memory', '更新附注')
  try {
    const input = parseUpdateMemoryNotePayload(payload)
    const item = await memoryItemService.updateNote(input.id, input.note)
    if (!item) {
      flowOk('Memory', '更新附注', startedAt, { id: input.id, found: false })
      return toErrorResponse('MEMORY_NOT_FOUND')
    }
    invalidateBookmarkSyncAlignmentCache()
    invalidateBookmarkLibraryTreeOnChromeChange()
    flowOk('Memory', '更新附注', startedAt, {
      id: item.id,
      noteLength: input.note.trim().length
    })
    return { ok: true, item }
  } catch (error) {
    flowFail('Memory', '更新附注', startedAt, error)
    return toErrorResponse('MEMORY_OPERATION_FAILED', error)
  }
}

/** 记录 MemoryItem 打开（行为信号）。 */
export async function handleRecordMemoryOpen(payload: unknown): Promise<MemoryBackgroundResponse> {
  const startedAt = flowStart('Memory', '记录打开')
  try {
    const input = parseRecordMemoryOpenPayload(payload)
    const item = await memoryItemService.recordOpen(input.id)
    if (!item) {
      flowOk('Memory', '记录打开', startedAt, { id: input.id, found: false })
      return toErrorResponse('MEMORY_NOT_FOUND')
    }
    flowOk('Memory', '记录打开', startedAt, {
      id: item.id,
      openCount: item.clues.openCount ?? null
    })
    return { ok: true, item }
  } catch (error) {
    flowFail('Memory', '记录打开', startedAt, error)
    return toErrorResponse('MEMORY_OPERATION_FAILED', error)
  }
}

/** 记录否定反馈（dismissCount）。 */
export async function handleRecordRecallDismiss(
  payload: unknown
): Promise<MemoryBackgroundResponse> {
  const startedAt = flowStart('Memory', '记录否定反馈')
  try {
    const input = parseRecordRecallDismissPayload(payload)
    const updated = await memoryItemService.recordDismiss(input.ids)
    flowOk('Memory', '记录否定反馈', startedAt, {
      idCount: input.ids.length,
      updated
    })
    return { ok: true, updated }
  } catch (error) {
    flowFail('Memory', '记录否定反馈', startedAt, error)
    return toErrorResponse('MEMORY_OPERATION_FAILED', error)
  }
}

/** 记录 settled 正例（settledCount · §7.2）。 */
export async function handleRecordRecallSettle(
  payload: unknown
): Promise<MemoryBackgroundResponse> {
  const startedAt = flowStart('Memory', '记录 settled')
  try {
    const input = parseRecordRecallSettlePayload(payload)
    const item = await memoryItemService.recordSettle(input.id)
    if (!item) {
      flowOk('Memory', '记录 settled', startedAt, { reason: 'not_found', id: input.id })
      return toErrorResponse('MEMORY_NOT_FOUND')
    }
    flowOk('Memory', '记录 settled', startedAt, {
      id: item.id,
      settledCount: item.clues.settledCount ?? null
    })
    return { ok: true, item }
  } catch (error) {
    flowFail('Memory', '记录 settled', startedAt, error)
    return toErrorResponse('MEMORY_OPERATION_FAILED', error)
  }
}

/** Settings Rebuild：同步写回缺失 embedding（须登录；避免被书签 sync 清队列）。 */
export async function handleBackfillMemoryEmbeddings(): Promise<MemoryBackgroundResponse> {
  const startedAt = flowStart('Memory', '回填 embedding')
  try {
    if (!(await getAuthSession())?.accessToken) {
      flowOk('Memory', '回填 embedding', startedAt, { reason: 'not_signed_in' })
      return toErrorResponse('EMBEDDING_BACKFILL_AUTH_REQUIRED')
    }
    const result = await backfillMissingMemoryEmbeddings()
    flowOk('Memory', '回填 embedding', startedAt, result)
    // enqueued 对外表示「已写入条数」
    return {
      ok: true,
      enqueued: result.written,
      scanned: result.scanned,
      failed: result.failed,
      quotaHit: result.quotaHit
    }
  } catch (error) {
    flowFail('Memory', '回填 embedding', startedAt, error)
    return toErrorResponse('MEMORY_OPERATION_FAILED', error)
  }
}

/** 多选导出 detail export（§5.10.4；≥1 条）。 */
export async function handleExportDetailExport(
  payload: unknown
): Promise<MemoryBackgroundResponse> {
  const startedAt = flowStart('Memory', '导出 detail export')
  try {
    const input = parseExportDetailExportPayload(payload)
    const result = await exportDetailExport(input.ids)
    flowOk('Memory', '导出 detail export', startedAt, {
      itemCount: result.pack.items.length
    })
    return { ok: true, pack: result.pack, markdown: result.markdown }
  } catch (error) {
    if (error instanceof DetailExportError) {
      flowFail('Memory', '导出 detail export', startedAt, error)
      return toErrorResponse(error.errorCode, error)
    }
    flowFail('Memory', '导出 detail export', startedAt, error)
    return toErrorResponse('DETAIL_EXPORT_OPERATION_FAILED', error)
  }
}
