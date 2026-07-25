import { isCodedError } from '@/core/common/coded-error'
import { optionalProp } from '@/core/common/optional-props'
import { memoryItemService } from '@/application/memory/memory-item-service'
import type { MemoryBackgroundResponse, MemoryErrorCode } from '@/core/messaging/memory-messages'
import {
  MemoryErrorCodeSchema,
  parseCaptureBookmarkPayload,
  parseCaptureTextExcerptPayload,
  parseDeleteMemoryItemPayload,
  parseGetMemoryItemPayload,
  parseListMemoryItemsPayload
} from '@/core/messaging/memory-messages'
import { flashActionBadge } from '@/infrastructure/browser/action-badge'
import { isSavablePageUrl } from '@/infrastructure/browser/active-tab-reader'
import { logger } from '@/infrastructure/logging/logger'

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
  try {
    const input = parseCaptureBookmarkPayload(payload)
    const item = await memoryItemService.captureBookmark({
      payload: {
        title: input.title,
        url: input.url,
        faviconUrl: input.faviconUrl
      },
      captureEntry: input.captureEntry ?? 'popup'
    })
    return { ok: true, item }
  } catch (error) {
    logger.error('Background', '捕获 Bookmark 失败', error)
    return toErrorResponse('MEMORY_OPERATION_FAILED', error)
  }
}

/** 捕获 Text Excerpt MemoryItem。 */
export async function handleCaptureTextExcerpt(
  payload: unknown
): Promise<MemoryBackgroundResponse> {
  try {
    const input = parseCaptureTextExcerptPayload(payload)
    if (!isSavablePageUrl(input.sourceUrl)) {
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
      captureEntry: input.captureEntry ?? 'context_menu'
    })
    void flashActionBadge('success')
    return { ok: true, item }
  } catch (error) {
    logger.error('Background', '捕获 Text Excerpt 失败', error)
    void flashActionBadge('error')
    return toErrorResponse('MEMORY_OPERATION_FAILED', error)
  }
}

/** 列出当前用户的 MemoryItem。 */
export async function handleListMemoryItems(payload: unknown): Promise<MemoryBackgroundResponse> {
  try {
    const options = parseListMemoryItemsPayload(payload)
    const items = await memoryItemService.list({
      ...optionalProp('type', options?.type),
      ...optionalProp('limit', options?.limit)
    })
    return { ok: true, items, total: items.length }
  } catch (error) {
    logger.error('Background', '列出 MemoryItem 失败', error)
    return toErrorResponse('MEMORY_OPERATION_FAILED', error)
  }
}

/** 按 id 读取 MemoryItem。 */
export async function handleGetMemoryItem(payload: unknown): Promise<MemoryBackgroundResponse> {
  try {
    const input = parseGetMemoryItemPayload(payload)
    const item = await memoryItemService.getById(input.id)
    if (!item) {
      return toErrorResponse('MEMORY_NOT_FOUND')
    }
    return { ok: true, item }
  } catch (error) {
    logger.error('Background', '读取 MemoryItem 失败', error)
    return toErrorResponse('MEMORY_OPERATION_FAILED', error)
  }
}

/** 软删 MemoryItem（仅允许 text_excerpt）。 */
export async function handleDeleteMemoryItem(payload: unknown): Promise<MemoryBackgroundResponse> {
  try {
    const input = parseDeleteMemoryItemPayload(payload)
    const existing = await memoryItemService.getById(input.id)
    if (!existing) {
      return toErrorResponse('MEMORY_NOT_FOUND')
    }
    if (existing.type !== 'text_excerpt') {
      return toErrorResponse('MEMORY_DELETE_BOOKMARK_FORBIDDEN')
    }

    const item = await memoryItemService.softDelete(input.id)
    if (!item) {
      return toErrorResponse('MEMORY_NOT_FOUND')
    }
    return { ok: true, item }
  } catch (error) {
    logger.error('Background', '删除 MemoryItem 失败', error)
    return toErrorResponse('MEMORY_OPERATION_FAILED', error)
  }
}
