import { optionalProp } from '@/core/common/optional-props'
import { memoryItemService } from '@/application/memory/memory-item-service'
import type { MemoryBackgroundResponse } from '@/core/messaging/memory-messages'
import {
  parseCaptureBookmarkPayload,
  parseCaptureTextExcerptPayload,
  parseDeleteMemoryItemPayload,
  parseGetMemoryItemPayload,
  parseListMemoryItemsPayload
} from '@/core/messaging/memory-messages'
import { flashActionBadge } from '@/infrastructure/browser/action-badge'
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
    void flashActionBadge('success')
    return { ok: true, item }
  } catch (error) {
    logger.error('Background', '捕获 Text Excerpt 失败', error)
    void flashActionBadge('error')
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

/** 按 id 读取 MemoryItem。 */
export async function handleGetMemoryItem(payload: unknown): Promise<MemoryBackgroundResponse> {
  try {
    const input = parseGetMemoryItemPayload(payload)
    const item = await memoryItemService.getById(input.id)
    if (!item) {
      return { ok: false, error: '未找到该记忆，可能已删除' }
    }
    return { ok: true, item }
  } catch (error) {
    logger.error('Background', '读取 MemoryItem 失败', error)
    return toErrorResponse(error)
  }
}

/** 软删 MemoryItem（仅允许 text_excerpt）。 */
export async function handleDeleteMemoryItem(payload: unknown): Promise<MemoryBackgroundResponse> {
  try {
    const input = parseDeleteMemoryItemPayload(payload)
    const existing = await memoryItemService.getById(input.id)
    if (!existing) {
      return { ok: false, error: '未找到该记忆，可能已删除' }
    }
    if (existing.type !== 'text_excerpt') {
      return { ok: false, error: '书签请在 Chrome 书签中删除，Yiveno 会自动同步' }
    }

    const item = await memoryItemService.softDelete(input.id)
    if (!item) {
      return { ok: false, error: '未找到该记忆，可能已删除' }
    }
    return { ok: true, item }
  } catch (error) {
    logger.error('Background', '删除 MemoryItem 失败', error)
    return toErrorResponse(error)
  }
}
