import {
  computeBookmarkLibraryStructureHash,
  mapChromeBookmarkTreeToLibraryIndex
} from '@/core/memory/bookmark-library-index'
import type {
  BookmarkSyncStalenessResponse,
  ChromeBookmarkImportStatusResponse,
  ColdStartStatusResponse,
  DeleteThirdPartyCorpusBySourceResponse,
  EnsureChromeBookmarksImportedResponse,
  GenerateGettingStartedClueSamplesResponse,
  GetBookmarkLibraryTreeResponse,
  ImportLocalMemoryResponse,
  ImportThirdPartyCorpusResponse,
  ThirdPartyCorpusSummaryResponse
} from '@/core/messaging/import-messages'
import {
  parseDeleteThirdPartyCorpusBySourcePayload,
  parseGenerateGettingStartedClueSamplesPayload,
  parseImportLocalMemoryPayload,
  parseImportThirdPartyCorpusPayload
} from '@/core/messaging/import-messages'
import { countUnsyncedChromeBookmarkLeaves } from '@/application/capture/chrome-bookmark-sync-staleness'
import {
  ensureChromeBookmarksImported,
  getChromeBookmarkImportStatus,
  scheduleEnsureChromeBookmarksImportedIfNeeded
} from '@/application/capture/import-chrome-bookmarks-service'
import {
  LocalMemoryImportError,
  importLocalMemoryBackup
} from '@/application/capture/import-local-memory-service'
import {
  ThirdPartyCorpusImportError,
  deleteThirdPartyCorpusBySource,
  getThirdPartyCorpusSummary,
  importThirdPartyCorpusExport
} from '@/application/capture/import-third-party-corpus-service'
import { generateGettingStartedClueSamples } from '@/application/onboarding/generate-getting-started-clue-samples'
import { readColdStartEnrichmentBatch } from '@/application/onboarding/cold-start-enrichment-batch-store'
import { readColdStartPipelineState } from '@/application/onboarding/cold-start-pipeline-service'
import {
  getLastBuiltBookmarkLibraryTree,
  invalidateBookmarkLibraryTreeCache,
  rememberBookmarkLibraryTreeBuild
} from '@/application/memory/bookmark-library-tree-cache'
import { getBookmarkSyncAlignmentCached } from '@/application/memory/bookmark-sync-alignment-cache'
import { t } from '@/infrastructure/i18n/t'
import { flowFail, flowOk, flowStart } from '@/infrastructure/logging/flow-log'
import { readChromeBookmarkDeleteTombstoneIds } from '@/infrastructure/storage/chrome-bookmark-delete-tombstone-storage'

/** Settings「重新导入」：跑 ensure（ingest 已开时 bulk / completed 时 finalize）。 */
export async function handleEnsureChromeBookmarksImported(): Promise<EnsureChromeBookmarksImportedResponse> {
  const startedAt = flowStart('Import', '重新导入 Chrome 书签')
  try {
    const state = await ensureChromeBookmarksImported()
    flowOk('Import', '重新导入 Chrome 书签', startedAt, {
      status: state.status,
      importedCount: state.importedCount,
      totalCount: state.totalCount ?? null
    })
    return { ok: true, state }
  } catch (error) {
    flowFail('Import', '重新导入 Chrome 书签', startedAt, error)
    return {
      ok: false,
      errorCode: 'IMPORT_STATUS_READ_FAILED',
      ...(error instanceof Error ? { error: error.message } : {})
    }
  }
}

/** 返回 Chrome 书签导入进度。 */
export async function handleGetChromeBookmarkImportStatus(): Promise<ChromeBookmarkImportStatusResponse> {
  const startedAt = flowStart('Import', '读取书签导入状态')
  try {
    const state = await getChromeBookmarkImportStatus()
    // Side Panel / GS 读状态时顺便会话级补洞（灌库开且 Memory 被掏空后的 completed 残留）
    scheduleEnsureChromeBookmarksImportedIfNeeded('import_status_read')
    flowOk('Import', '读取书签导入状态', startedAt, {
      status: state?.status ?? null,
      importedCount: state?.importedCount ?? null,
      totalCount: state?.totalCount ?? null
    })
    return { ok: true, state }
  } catch (error) {
    flowFail('Import', '读取书签导入状态', startedAt, error)
    return {
      ok: false,
      errorCode: 'IMPORT_STATUS_READ_FAILED',
      ...(error instanceof Error ? { error: error.message } : {})
    }
  }
}

/** 返回冷启动三阶段门禁进度。 */
export async function handleGetColdStartStatus(): Promise<ColdStartStatusResponse> {
  const startedAt = flowStart('ColdStart', '读取冷启动门禁状态')
  try {
    const [state, enrichmentBatch] = await Promise.all([
      readColdStartPipelineState(),
      readColdStartEnrichmentBatch()
    ])
    flowOk('ColdStart', '读取冷启动门禁状态', startedAt, {
      status: state?.status ?? null,
      stage: state?.stage ?? null,
      enrichmentSettled: enrichmentBatch?.settled ?? null,
      enrichmentTotal: enrichmentBatch?.total ?? null,
      enrichmentStatus: enrichmentBatch?.status ?? null
    })
    return { ok: true, state, enrichmentBatch }
  } catch (error) {
    flowFail('ColdStart', '读取冷启动门禁状态', startedAt, error)
    return {
      ok: false,
      errorCode: 'COLD_START_STATUS_READ_FAILED',
      ...(error instanceof Error ? { error: error.message } : {})
    }
  }
}

/** Getting Started：生成示意 clue（LLM 或模板回退）。 */
export async function handleGenerateGettingStartedClueSamples(
  payload: unknown
): Promise<GenerateGettingStartedClueSamplesResponse> {
  const startedAt = flowStart('Onboarding', '生成 GS 示意 clue')
  try {
    const parsed = parseGenerateGettingStartedClueSamplesPayload(payload)
    const tree = await handleGetBookmarkLibraryTree({})
    if (!tree.ok || !('index' in tree) || !tree.index) {
      flowFail('Onboarding', '生成 GS 示意 clue', startedAt, new Error('library_tree_unavailable'))
      return { ok: false, errorCode: 'LIBRARY_TREE_READ_FAILED' }
    }

    const result = await generateGettingStartedClueSamples({
      nodes: tree.index.nodes,
      fallbackClue: parsed.fallbackClue ?? 'something I bookmarked'
    })
    if (!result) {
      return { ok: false, errorCode: 'GS_CLUE_SAMPLES_FAILED', error: 'no_clues' }
    }
    flowOk('Onboarding', '生成 GS 示意 clue', startedAt, {
      origin: result.origin,
      fromCache: result.fromCache,
      clueCount: result.clues.length
    })
    return {
      ok: true,
      clues: result.clues,
      origin: result.origin,
      chromeId: result.chromeId,
      title: result.title,
      ...(result.url ? { url: result.url } : {}),
      fromCache: result.fromCache
    }
  } catch (error) {
    flowFail('Onboarding', '生成 GS 示意 clue', startedAt, error)
    return {
      ok: false,
      errorCode: 'GS_CLUE_SAMPLES_FAILED',
      ...(error instanceof Error ? { error: error.message } : {})
    }
  }
}

function toChromeTreeInput(node: chrome.bookmarks.BookmarkTreeNode): {
  id: string
  title?: string
  url?: string
  dateAdded?: number
  children?: ReturnType<typeof toChromeTreeInput>[]
} {
  return {
    id: node.id,
    ...(node.title !== undefined ? { title: node.title } : {}),
    ...(node.url !== undefined ? { url: node.url } : {}),
    ...(typeof node.dateAdded === 'number' ? { dateAdded: node.dateAdded } : {}),
    ...(node.children ? { children: node.children.map(child => toChromeTreeInput(child)) } : {})
  }
}

export interface GetBookmarkLibraryTreeOptions {
  clientHash?: string | undefined
}

/** 读取 Chrome 书签扁平索引并与 Memory 对齐（只读）。 */
export async function handleGetBookmarkLibraryTree(
  options: GetBookmarkLibraryTreeOptions = {}
): Promise<GetBookmarkLibraryTreeResponse> {
  const startedAt = flowStart('Import', '读取书签目录树')
  try {
    const [chromeTree, alignment, importState, tombstonedChromeBookmarkIds] = await Promise.all([
      chrome.bookmarks.getTree(),
      getBookmarkSyncAlignmentCached(),
      getChromeBookmarkImportStatus(),
      readChromeBookmarkDeleteTombstoneIds()
    ])

    const index = mapChromeBookmarkTreeToLibraryIndex(
      chromeTree.map(node => toChromeTreeInput(node)),
      alignment.byChromeBookmarkId,
      {
        unnamedFolderTitle: t('library_folder_unnamed'),
        memoryIdByUrl: alignment.byUrl,
        noteByMemoryId: alignment.noteByMemoryId,
        savedAtByMemoryId: alignment.savedAtByMemoryId,
        tombstonedChromeBookmarkIds
      }
    )

    const structureHash = computeBookmarkLibraryStructureHash(index)
    const syncReady = importState?.status === 'completed'

    if (options.clientHash && options.clientHash === structureHash) {
      const last = getLastBuiltBookmarkLibraryTree()
      if (last && last.structureHash === structureHash) {
        flowOk('Import', '读取书签目录树', startedAt, {
          bookmarkCount: index.bookmarkCount,
          syncReady,
          unchanged: true
        })
        return {
          ok: true,
          unchanged: true,
          structureHash,
          bookmarkCount: index.bookmarkCount,
          syncReady
        }
      }
    }

    rememberBookmarkLibraryTreeBuild(index, structureHash)

    flowOk('Import', '读取书签目录树', startedAt, {
      bookmarkCount: index.bookmarkCount,
      syncReady,
      unchanged: false
    })
    return {
      ok: true,
      index,
      structureHash,
      bookmarkCount: index.bookmarkCount,
      syncReady
    }
  } catch (error) {
    flowFail('Import', '读取书签目录树', startedAt, error)
    invalidateBookmarkLibraryTreeCache()
    return {
      ok: false,
      errorCode: 'LIBRARY_TREE_READ_FAILED',
      ...(error instanceof Error ? { error: error.message } : {})
    }
  }
}

/** Chrome 书签树结构变更：失效 SW 侧索引缓存。 */
export function invalidateBookmarkLibraryTreeOnChromeChange(): void {
  invalidateBookmarkLibraryTreeCache()
}

/** 导入 Raindrop / Pocket 导出（§5.10.6）。 */
export async function handleImportThirdPartyCorpus(
  payload: unknown
): Promise<ImportThirdPartyCorpusResponse> {
  const startedAt = flowStart('Import', '第三方语料导入')
  try {
    const input = parseImportThirdPartyCorpusPayload(payload)
    const result = await importThirdPartyCorpusExport({
      source: input.source,
      content: input.content,
      ...(input.format ? { format: input.format } : {})
    })
    invalidateBookmarkLibraryTreeOnChromeChange()
    flowOk('Import', '第三方语料导入', startedAt, {
      source: input.source,
      importedCount: result.importedCount
    })
    return { ok: true, importedCount: result.importedCount }
  } catch (error) {
    if (error instanceof ThirdPartyCorpusImportError) {
      flowFail('Import', '第三方语料导入', startedAt, error)
      return { ok: false, errorCode: error.errorCode, error: error.message }
    }
    flowFail('Import', '第三方语料导入', startedAt, error)
    return {
      ok: false,
      errorCode: 'THIRD_PARTY_IMPORT_FAILED',
      ...(error instanceof Error ? { error: error.message } : {})
    }
  }
}

/** 恢复本地 Backup JSON（含 L3）。 */
export async function handleImportLocalMemory(
  payload: unknown
): Promise<ImportLocalMemoryResponse> {
  const startedAt = flowStart('Import', '本地 Backup 恢复')
  try {
    const input = parseImportLocalMemoryPayload(payload)
    const result = await importLocalMemoryBackup({ content: input.content })
    invalidateBookmarkLibraryTreeOnChromeChange()
    flowOk('Import', '本地 Backup 恢复', startedAt, result)
    return { ok: true, ...result }
  } catch (error) {
    if (error instanceof LocalMemoryImportError) {
      flowFail('Import', '本地 Backup 恢复', startedAt, error)
      return { ok: false, errorCode: error.errorCode, error: error.message }
    }
    flowFail('Import', '本地 Backup 恢复', startedAt, error)
    return {
      ok: false,
      errorCode: 'LOCAL_IMPORT_FAILED',
      ...(error instanceof Error ? { error: error.message } : {})
    }
  }
}

/** 读取两来源第三方语料条数与最近导入状态。 */
export async function handleGetThirdPartyCorpusSummary(): Promise<ThirdPartyCorpusSummaryResponse> {
  const startedAt = flowStart('Import', '读取第三方语料摘要')
  try {
    const sources = await getThirdPartyCorpusSummary()
    flowOk('Import', '读取第三方语料摘要', startedAt, {
      raindropCount: sources.raindrop.count,
      pocketCount: sources.pocket.count
    })
    return { ok: true, sources }
  } catch (error) {
    flowFail('Import', '读取第三方语料摘要', startedAt, error)
    return {
      ok: false,
      errorCode: 'IMPORT_STATUS_READ_FAILED',
      ...(error instanceof Error ? { error: error.message } : {})
    }
  }
}

/** 同步关时未进库的 Chrome 书签叶子数（只读计数）。 */
export async function handleGetBookmarkSyncStaleness(): Promise<BookmarkSyncStalenessResponse> {
  const startedAt = flowStart('Import', '读取书签同步 stale 计数')
  try {
    const unsyncedCount = await countUnsyncedChromeBookmarkLeaves()
    flowOk('Import', '读取书签同步 stale 计数', startedAt, { unsyncedCount })
    return { ok: true, unsyncedCount }
  } catch (error) {
    flowFail('Import', '读取书签同步 stale 计数', startedAt, error)
    return {
      ok: false,
      errorCode: 'IMPORT_STATUS_READ_FAILED',
      ...(error instanceof Error ? { error: error.message } : {})
    }
  }
}

/** 按来源硬删全部第三方导入副本。 */
export async function handleDeleteThirdPartyCorpusBySource(
  payload: unknown
): Promise<DeleteThirdPartyCorpusBySourceResponse> {
  const startedAt = flowStart('Import', '按来源删除第三方语料')
  try {
    const input = parseDeleteThirdPartyCorpusBySourcePayload(payload)
    const result = await deleteThirdPartyCorpusBySource(input.source)
    invalidateBookmarkLibraryTreeOnChromeChange()
    flowOk('Import', '按来源删除第三方语料', startedAt, {
      source: input.source,
      deletedCount: result.deletedCount
    })
    return { ok: true, deletedCount: result.deletedCount }
  } catch (error) {
    flowFail('Import', '按来源删除第三方语料', startedAt, error)
    return {
      ok: false,
      errorCode: 'IMPORT_STATUS_READ_FAILED',
      ...(error instanceof Error ? { error: error.message } : {})
    }
  }
}
