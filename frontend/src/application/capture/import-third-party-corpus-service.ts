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
import type { ThirdPartyCorpusSource } from '@/core/memory/third-party-corpus-source'
import { flowFail, flowOk, flowStart } from '@/infrastructure/logging/flow-log'
import {
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

/** 读取第三方导入进度（不触发导入）。 */
export async function getThirdPartyCorpusImportStatus() {
  return readThirdPartyCorpusImportState()
}

/** 导入 Raindrop / Pocket 导出文件（≤50 条）。 */
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

  await writeThirdPartyCorpusImportState({
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

    await writeThirdPartyCorpusImportState({
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
        await writeThirdPartyCorpusImportState({
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
    await writeThirdPartyCorpusImportState({
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
    await writeThirdPartyCorpusImportState({
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

export { mapParseError as mapThirdPartyCorpusImportErrorForTests }
