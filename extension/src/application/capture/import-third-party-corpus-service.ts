/**
 * Raindrop / Pocket 导出导入（§5.10.6 · R2 准入）。
 */

import { memoryItemService } from '@/application/memory/memory-item-service'
import { invalidateBookmarkSyncAlignmentCache } from '@/application/memory/bookmark-sync-alignment-cache'
import { extractDomainFromUrl } from '@/core/memory/payload'
import {
  ThirdPartyCorpusParseError,
  parseThirdPartyCorpusExport,
  type ThirdPartyCorpusExportFormat
} from '@/core/memory/parse-third-party-corpus-export'
import type { ThirdPartyCorpusImportErrorCode } from '@/core/memory/third-party-corpus-import-state'
import type { ThirdPartyCorpusImportState } from '@/core/memory/third-party-corpus-import-state'
import type { ThirdPartyCorpusSource } from '@/core/memory/third-party-corpus-source'
import { flowFail, flowOk, flowStart } from '@/infrastructure/logging/flow-log'
import {
  clearThirdPartyCorpusImportState,
  readThirdPartyCorpusImportState,
  writeThirdPartyCorpusImportState
} from '@/infrastructure/storage/third-party-corpus-import-storage'

export class ThirdPartyCorpusImportError extends Error {
  readonly errorCode: ThirdPartyCorpusImportErrorCode

  constructor(errorCode: ThirdPartyCorpusImportErrorCode, message?: string) {
    super(message ?? errorCode)
    this.name = 'ThirdPartyCorpusImportError'
    this.errorCode = errorCode
  }
}

let importInFlight: Promise<{ importedCount: number }> | null = null

function mapParseError(error: unknown): ThirdPartyCorpusImportError {
  if (error instanceof ThirdPartyCorpusParseError) {
    return new ThirdPartyCorpusImportError(error.errorCode)
  }
  return new ThirdPartyCorpusImportError('THIRD_PARTY_IMPORT_FAILED')
}

/** 单来源摘要：活跃条数 + 最近一次导入状态。 */
export type ThirdPartyCorpusSourceSummary = {
  count: number
  lastImport: ThirdPartyCorpusImportState | null
}

/** 两来源汇总（Settings「第三方数据」分区）。 */
export type ThirdPartyCorpusSummary = {
  raindrop: ThirdPartyCorpusSourceSummary
  pocket: ThirdPartyCorpusSourceSummary
}

/** 读取两来源条数与最近导入状态。 */
export async function getThirdPartyCorpusSummary(): Promise<ThirdPartyCorpusSummary> {
  const [raindropCount, pocketCount, raindropLast, pocketLast] = await Promise.all([
    memoryItemService.countActiveByCorpusSource('raindrop'),
    memoryItemService.countActiveByCorpusSource('pocket'),
    readThirdPartyCorpusImportState('raindrop'),
    readThirdPartyCorpusImportState('pocket')
  ])
  return {
    raindrop: { count: raindropCount, lastImport: raindropLast },
    pocket: { count: pocketCount, lastImport: pocketLast }
  }
}

/** 按来源硬删全部导入副本，并清除该来源导入状态。 */
export async function deleteThirdPartyCorpusBySource(
  source: ThirdPartyCorpusSource
): Promise<{ deletedCount: number }> {
  const startedAt = flowStart('ThirdPartyImport', '按来源删除', { source })
  const deletedCount = await memoryItemService.hardDeleteByCorpusSource(source)
  await clearThirdPartyCorpusImportState(source)
  invalidateBookmarkSyncAlignmentCache()
  flowOk('ThirdPartyImport', '按来源删除完成', startedAt, { source, deletedCount })
  return { deletedCount }
}

/** 导入 Raindrop / Pocket 导出文件。 */
export async function importThirdPartyCorpusExport(input: {
  source: ThirdPartyCorpusSource
  content: string
  format?: ThirdPartyCorpusExportFormat
}): Promise<{ importedCount: number }> {
  if (importInFlight) {
    throw new ThirdPartyCorpusImportError('THIRD_PARTY_IMPORT_IN_PROGRESS')
  }

  importInFlight = runImport(input).finally(() => {
    importInFlight = null
  })
  return importInFlight
}

async function runImport(input: {
  source: ThirdPartyCorpusSource
  content: string
  format?: ThirdPartyCorpusExportFormat
}): Promise<{ importedCount: number }> {
  const startedAt = flowStart('ThirdPartyImport', '开始', { source: input.source })
  const startedIso = new Date().toISOString()

  await writeThirdPartyCorpusImportState(input.source, {
    status: 'running',
    source: input.source,
    importedCount: 0,
    totalCount: 0,
    startedAt: startedIso
  })

  try {
    const parsed = parseThirdPartyCorpusExport({
      source: input.source,
      content: input.content,
      ...(input.format ? { format: input.format } : {})
    })

    await writeThirdPartyCorpusImportState(input.source, {
      status: 'running',
      source: input.source,
      importedCount: 0,
      totalCount: parsed.length,
      startedAt: startedIso
    })

    let importedCount = 0

    for (const row of parsed) {
      const itemInput = {
        payload: {
          title: row.title,
          url: row.url,
          domain: extractDomainFromUrl(row.url),
          corpusSource: input.source,
          remoteId: row.remoteId,
          ...(row.createdAt ? { sourceCreatedAt: row.createdAt } : {})
        },
        ...(row.note ? { clues: { note: row.note } } : {}),
        captureEntry: 'import' as const
      }

      await memoryItemService.upsertBookmarkFromThirdPartyCorpus(itemInput)
      importedCount += 1

      if (importedCount % 5 === 0 || importedCount === parsed.length) {
        await writeThirdPartyCorpusImportState(input.source, {
          status: 'running',
          source: input.source,
          importedCount,
          totalCount: parsed.length,
          startedAt: startedIso
        })
      }
    }

    invalidateBookmarkSyncAlignmentCache()

    const finishedAt = new Date().toISOString()
    await writeThirdPartyCorpusImportState(input.source, {
      status: 'completed',
      source: input.source,
      importedCount,
      totalCount: parsed.length,
      startedAt: startedIso,
      finishedAt
    })

    flowOk('ThirdPartyImport', '完成', startedAt, {
      source: input.source,
      importedCount,
      totalParsed: parsed.length
    })

    return { importedCount }
  } catch (error) {
    const mapped = mapParseError(error)
    await writeThirdPartyCorpusImportState(input.source, {
      status: 'failed',
      source: input.source,
      importedCount: 0,
      totalCount: 0,
      startedAt: startedIso,
      finishedAt: new Date().toISOString(),
      errorCode: mapped.errorCode
    })
    flowFail('ThirdPartyImport', '失败', startedAt, mapped)
    throw mapped
  }
}
