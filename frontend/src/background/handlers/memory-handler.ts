import { isCodedError } from '@/core/common/coded-error'
import { optionalProp } from '@/core/common/optional-props'
import { isChromeBookmarkIngestEnabled } from '@/application/capture/chrome-bookmark-sync-service'
import { memoryItemService } from '@/application/memory/memory-item-service'
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
  parseUpdateMemoryNotePayload
} from '@/core/messaging/memory-messages'
import { flashActionBadge } from '@/infrastructure/browser/action-badge'
import { isSavablePageUrl } from '@/infrastructure/browser/active-tab-reader'
import { flowFail, flowOk, flowStart, previewText } from '@/infrastructure/logging/flow-log'

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
    flowOk('Memory', '删除条目', startedAt, { id: item.id })
    return { ok: true, item }
  } catch (error) {
    flowFail('Memory', '删除条目', startedAt, error)
    return toErrorResponse('MEMORY_OPERATION_FAILED', error)
  }
}

/** 更新 clues.note（书签/摘录事后补注）。 */
export async function handleUpdateMemoryNote(payload: unknown): Promise<MemoryBackgroundResponse> {
  const startedAt = flowStart('Memory', '更新备注')
  try {
    const input = parseUpdateMemoryNotePayload(payload)
    const item = await memoryItemService.updateNote(input.id, input.note)
    if (!item) {
      flowOk('Memory', '更新备注', startedAt, { id: input.id, found: false })
      return toErrorResponse('MEMORY_NOT_FOUND')
    }
    flowOk('Memory', '更新备注', startedAt, {
      id: item.id,
      noteLength: input.note.trim().length
    })
    return { ok: true, item }
  } catch (error) {
    flowFail('Memory', '更新备注', startedAt, error)
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

/** 将缺失 embedding 的本机条目入队回填（须登录；Worker 日配额分档）。 */
export async function handleBackfillMemoryEmbeddings(): Promise<MemoryBackgroundResponse> {
  const startedAt = flowStart('Memory', '回填 embedding')
  try {
    const { getAuthSession } = await import('@/infrastructure/identity/auth-session-service')
    if (!(await getAuthSession())?.accessToken) {
      flowOk('Memory', '回填 embedding', startedAt, { reason: 'not_signed_in' })
      return toErrorResponse('EMBEDDING_BACKFILL_AUTH_REQUIRED')
    }
    const { enqueueMissingMemoryEmbeddings } =
      await import('@/application/memory/schedule-async-memory-embedding')
    const result = await enqueueMissingMemoryEmbeddings()
    flowOk('Memory', '回填 embedding', startedAt, result)
    return { ok: true, enqueued: result.enqueued, scanned: result.scanned }
  } catch (error) {
    flowFail('Memory', '回填 embedding', startedAt, error)
    return toErrorResponse('MEMORY_OPERATION_FAILED', error)
  }
}
