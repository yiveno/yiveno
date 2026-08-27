/**
 * 导出 evidence pack：按 id 加载 MemoryItem 并构建 JSON + Markdown。
 */

import { isCodedError } from '@/core/common/coded-error'
import { memoryItemService } from '@/application/memory/memory-item-service'
import {
  buildEvidencePack,
  renderEvidencePackMarkdown,
  validateEvidencePackSelectionCount,
  type EvidencePack
} from '@/core/recall/evidence-pack'
import { flowFail, flowOk, flowStart } from '@/infrastructure/logging/flow-log'

export class EvidencePackExportError extends Error {
  readonly errorCode:
    | 'EVIDENCE_PACK_INVALID_COUNT'
    | 'EVIDENCE_PACK_ITEM_NOT_FOUND'
    | 'EVIDENCE_PACK_OPERATION_FAILED'

  constructor(
    errorCode:
      | 'EVIDENCE_PACK_INVALID_COUNT'
      | 'EVIDENCE_PACK_ITEM_NOT_FOUND'
      | 'EVIDENCE_PACK_OPERATION_FAILED',
    message?: string
  ) {
    super(message ?? errorCode)
    this.name = 'EvidencePackExportError'
    this.errorCode = errorCode
  }
}

function assertExportErrorCode(error: unknown): EvidencePackExportError['errorCode'] {
  if (error instanceof EvidencePackExportError) {
    return error.errorCode
  }
  if (isCodedError(error) && error.errorCode === 'MEMORY_NOT_FOUND') {
    return 'EVIDENCE_PACK_ITEM_NOT_FOUND'
  }
  return 'EVIDENCE_PACK_OPERATION_FAILED'
}

/** 按 id 列表导出 evidence pack（2–5 条；不含软删）。 */
export async function exportEvidencePack(ids: string[]): Promise<{
  pack: EvidencePack
  markdown: string
}> {
  const startedAt = flowStart('EvidencePack', '导出', { count: ids.length })
  const uniqueIds = [...new Set(ids.map(id => id.trim()).filter(Boolean))]
  if (!validateEvidencePackSelectionCount(uniqueIds.length)) {
    flowFail('EvidencePack', '导出', startedAt, new Error('invalid_count'))
    throw new EvidencePackExportError('EVIDENCE_PACK_INVALID_COUNT')
  }

  try {
    const items = await Promise.all(uniqueIds.map(id => memoryItemService.getById(id)))
    for (const item of items) {
      if (!item || item.deletedAt) {
        throw new EvidencePackExportError('EVIDENCE_PACK_ITEM_NOT_FOUND')
      }
    }
    const pack = buildEvidencePack(
      items.filter((item): item is NonNullable<typeof item> => item !== null)
    )
    const markdown = renderEvidencePackMarkdown(pack)
    flowOk('EvidencePack', '导出', startedAt, {
      itemCount: pack.items.length,
      types: pack.items.map(item => item.type)
    })
    return { pack, markdown }
  } catch (error) {
    if (error instanceof EvidencePackExportError) {
      flowFail('EvidencePack', '导出', startedAt, error)
      throw error
    }
    const code = assertExportErrorCode(error)
    flowFail('EvidencePack', '导出', startedAt, error)
    throw new EvidencePackExportError(code, error instanceof Error ? error.message : String(error))
  }
}
