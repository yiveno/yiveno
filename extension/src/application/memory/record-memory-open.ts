/**
 * 记录 MemoryItem 打开（行为信号）的共享实现。
 * Background handler 与语音自动打开等 application 路径共用，避免 application → background 逆向依赖。
 */

import { isCodedError } from '@/core/common/coded-error'
import type { MemoryItem } from '@/core/memory/memory-item'
import type { MemoryBackgroundResponse, MemoryErrorCode } from '@/core/messaging/memory-messages'
import {
  MemoryErrorCodeSchema,
  parseRecordMemoryOpenPayload
} from '@/core/messaging/memory-messages'
import { memoryItemService } from '@/application/memory/memory-item-service'
import { schedulePageContentExtractOnOpen } from '@/application/memory/page-content-extract-service'
import { schedulePagePreviewOpenBackfill } from '@/application/memory/page-preview-capture-service'
import { flowFail, flowOk, flowStart } from '@/infrastructure/logging/flow-log'

/** 书签 URL / 摘录源站 URL，供打开后补图与正文提炼。 */
function pageUrlOfMemoryItem(item: MemoryItem): string | null {
  if (item.type === 'bookmark') {
    const url = item.payload.url.trim()
    return url || null
  }
  const url = item.payload.sourceUrl.trim()
  return url || null
}

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

/**
 * 记录打开：写 openCount，并在有页 URL 时触发补图与打开提炼。
 * 不写 open_confirm（那是结果卡点击确认语义）。
 */
export async function recordMemoryOpen(payload: unknown): Promise<MemoryBackgroundResponse> {
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
    const pageUrl = pageUrlOfMemoryItem(item)
    if (pageUrl) {
      schedulePagePreviewOpenBackfill({ pageUrl })
      schedulePageContentExtractOnOpen({ item, pageUrl })
    }
    return { ok: true, item }
  } catch (error) {
    flowFail('Memory', '记录打开', startedAt, error)
    return toErrorResponse('MEMORY_OPERATION_FAILED', error)
  }
}
