import { optionalProp } from '@/core/common/optional-props'
import { memoryItemService } from '@/application/memory/memory-item-service'
import type { MemoryBackgroundResponse } from '@/core/messaging/memory-messages'
import {
  parseCaptureBookmarkPayload,
  parseCaptureTextExcerptPayload,
  parseListMemoryItemsPayload
} from '@/core/messaging/memory-messages'
import { logger } from '@/infrastructure/logging/logger'

function toErrorResponse(error: unknown): MemoryBackgroundResponse {
  if (error instanceof Error) {
    return { ok: false, error: error.message }
  }
  return { ok: false, error: 'MemoryItem 操作失败' }
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
    return toErrorResponse(error)
  }
}

/** 捕获 Text Excerpt MemoryItem。 */
export async function handleCaptureTextExcerpt(
  payload: unknown
): Promise<MemoryBackgroundResponse> {
  try {
    const input = parseCaptureTextExcerptPayload(payload)
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
    return { ok: true, item }
  } catch (error) {
    logger.error('Background', '捕获 Text Excerpt 失败', error)
    return toErrorResponse(error)
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
    return toErrorResponse(error)
  }
}
