/**
 * Detail export：按 id 加载 MemoryItem 并构建 JSON + Markdown。
 */

import { isCodedError } from '@/core/common/coded-error'
import { memoryItemService } from '@/application/memory/memory-item-service'
import {
  buildDetailExport,
  renderDetailExportMarkdown,
  validateDetailExportSelectionCount,
  type DetailExport
} from '@/core/recall/detail-export'
import { flowFail, flowOk, flowStart } from '@/infrastructure/logging/flow-log'

export class DetailExportError extends Error {
  readonly errorCode:
    | 'DETAIL_EXPORT_INVALID_COUNT'
    | 'DETAIL_EXPORT_ITEM_NOT_FOUND'
    | 'DETAIL_EXPORT_OPERATION_FAILED'

  constructor(
    errorCode:
      | 'DETAIL_EXPORT_INVALID_COUNT'
      | 'DETAIL_EXPORT_ITEM_NOT_FOUND'
      | 'DETAIL_EXPORT_OPERATION_FAILED',
    message?: string
  ) {
    super(message ?? errorCode)
    this.name = 'DetailExportError'
    this.errorCode = errorCode
  }
}

function assertExportErrorCode(error: unknown): DetailExportError['errorCode'] {
  if (error instanceof DetailExportError) {
    return error.errorCode
  }
  if (isCodedError(error) && error.errorCode === 'MEMORY_NOT_FOUND') {
    return 'DETAIL_EXPORT_ITEM_NOT_FOUND'
  }
  return 'DETAIL_EXPORT_OPERATION_FAILED'
}

/** 按 id 列表构建 Detail export（≥1 条；不含软删）。 */
export async function exportDetailExport(ids: string[]): Promise<{
  pack: DetailExport
  markdown: string
}> {
  const startedAt = flowStart('DetailExport', '导出', { count: ids.length })
  const uniqueIds = [...new Set(ids.map(id => id.trim()).filter(Boolean))]
  if (!validateDetailExportSelectionCount(uniqueIds.length)) {
    flowFail('DetailExport', '导出', startedAt, new Error('invalid_count'))
    throw new DetailExportError('DETAIL_EXPORT_INVALID_COUNT')
  }

  try {
    const items = await Promise.all(uniqueIds.map(id => memoryItemService.getById(id)))
    for (const item of items) {
      if (!item || item.deletedAt) {
        throw new DetailExportError('DETAIL_EXPORT_ITEM_NOT_FOUND')
      }
    }
    const pack = buildDetailExport(
      items.filter((item): item is NonNullable<typeof item> => item !== null)
    )
    const markdown = renderDetailExportMarkdown(pack)
    flowOk('DetailExport', '导出', startedAt, {
      itemCount: pack.items.length,
      types: pack.items.map(item => item.type)
    })
    return { pack, markdown }
  } catch (error) {
    if (error instanceof DetailExportError) {
      flowFail('DetailExport', '导出', startedAt, error)
      throw error
    }
    const code = assertExportErrorCode(error)
    flowFail('DetailExport', '导出', startedAt, error)
    throw new DetailExportError(code, error instanceof Error ? error.message : String(error))
  }
}
