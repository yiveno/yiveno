import {
  CHROME_BOOKMARK_IMPORT_STORAGE_KEY,
  ChromeBookmarkImportStateSchema,
  type ChromeBookmarkImportState
} from '@/core/memory/chrome-bookmark-import-state'
import { createBookmarkMemoryItem } from '@/core/memory/create-memory-item'
import type { MemoryItem } from '@/core/memory/memory-item'
import type { ChromeBookmarkLeaf } from '@/infrastructure/browser/chrome-bookmark-reader'
import { MEMORY_ITEM_BULK_IMPORT_BATCH_SIZE } from '@/infrastructure/indexeddb/constants'
import {
  getCurrentOwnerId,
  getOrCreateLocalProfile
} from '@/infrastructure/identity/local-profile-service'
import { memoryItemRepository } from '@/infrastructure/indexeddb/memory-item-repository'
import { logger } from '@/infrastructure/logging/logger'
import { readChromeBookmarkDeleteTombstoneIds } from '@/infrastructure/storage/chrome-bookmark-delete-tombstone-storage'
import {
  readChromeStorageLocal,
  removeChromeStorageLocal,
  writeChromeStorageLocal
} from '@/infrastructure/storage/chrome-storage-local'

const UPSERT_PROGRESS_INTERVAL = 100

/** 批量构建 Bookmark MemoryItem（无 IndexedDB 查询）。 */
export async function buildBookmarkItemsFromChromeLeaves(
  leaves: ChromeBookmarkLeaf[]
): Promise<ReturnType<typeof createBookmarkMemoryItem>[]> {
  const [ownerId, profile] = await Promise.all([getCurrentOwnerId(), getOrCreateLocalProfile()])
  const now = () => new Date().toISOString()

  return leaves.map(leaf =>
    createBookmarkMemoryItem({
      ownerId,
      sourceLocalProfileId: profile.localProfileId,
      captureEntry: 'sync',
      now,
      payload: {
        title: leaf.title,
        url: leaf.url,
        chromeBookmarkId: leaf.chromeBookmarkId,
        parentFolderId: leaf.parentFolderId,
        chromeCreatedAt: leaf.chromeCreatedAt
      }
    })
  )
}

/**
 * 同 chromeBookmarkId 多活行时保留 1 行的排序键（升序：排前保留）。
 * 规则：① 有非空 note 优先；② openCount+settledCount 最大；③ createdAt 最早。
 */
function compareDuplicateBookmarkKeepOrder(a: MemoryItem, b: MemoryItem): number {
  const noteA = a.clues.note?.trim() ? 1 : 0
  const noteB = b.clues.note?.trim() ? 1 : 0
  if (noteA !== noteB) {
    return noteB - noteA
  }
  const scoreA = (a.clues.openCount ?? 0) + (a.clues.settledCount ?? 0)
  const scoreB = (b.clues.openCount ?? 0) + (b.clues.settledCount ?? 0)
  if (scoreA !== scoreB) {
    return scoreB - scoreA
  }
  return a.createdAt.localeCompare(b.createdAt)
}

/**
 * offset 0 导入前：按 chromeBookmarkId 扫除同 id 多活行（硬删多余行，不写墓碑）。
 * 软删行不动。仅跑一次（由 bulkPut 在 startOffset===0 时调用）。
 */
async function sweepDuplicateLiveChromeBookmarkRows(): Promise<number> {
  const items = await memoryItemRepository.listByOwner({
    type: 'bookmark',
    limit: Number.MAX_SAFE_INTEGER
  })

  const groups = new Map<string, MemoryItem[]>()
  for (const item of items) {
    if (item.type !== 'bookmark' || item.deletedAt != null) {
      continue
    }
    const chromeId = item.payload.chromeBookmarkId?.trim()
    if (!chromeId) {
      continue
    }
    const group = groups.get(chromeId) ?? []
    group.push(item)
    groups.set(chromeId, group)
  }

  const idsToDelete: string[] = []
  for (const group of groups.values()) {
    if (group.length <= 1) {
      continue
    }
    const sorted = [...group].sort(compareDuplicateBookmarkKeepOrder)
    for (const extra of sorted.slice(1)) {
      idsToDelete.push(extra.id)
    }
  }

  if (idsToDelete.length === 0) {
    return 0
  }

  const deleted = await memoryItemRepository.hardDeleteMany(idsToDelete)
  logger.info('ChromeBookmarkImport', 'offset 0 导入前扫除重复活书签行', {
    deleted,
    groupCount: [...groups.values()].filter(g => g.length > 1).length
  })
  return deleted
}

/**
 * 一次扫描当前 owner 活书签的 chromeBookmarkId 集合。
 * 语义对齐 upsertBookmarkFromChrome → getByChromeBookmarkId（同 owner、仅活行）。
 */
async function listLiveChromeBookmarkIdSet(): Promise<Set<string>> {
  const items = await memoryItemRepository.listByOwner({
    type: 'bookmark',
    limit: Number.MAX_SAFE_INTEGER
  })
  const ids = new Set<string>()
  for (const item of items) {
    if (item.type !== 'bookmark' || item.deletedAt != null) {
      continue
    }
    const chromeId = item.payload.chromeBookmarkId?.trim()
    if (chromeId) {
      ids.add(chromeId)
    }
  }
  return ids
}

/** 批量写入 Chrome 书签叶子（单事务 per batch；一次读墓碑集并内存过滤）。 */
export async function bulkPutChromeBookmarkLeaves(
  leaves: ChromeBookmarkLeaf[],
  startOffset = 0,
  onBatchComplete?: (importedCount: number) => Promise<void>
): Promise<number> {
  let importedCount = startOffset
  const tombstones = await readChromeBookmarkDeleteTombstoneIds()

  // offset 0：先扫除历史重复活行（续传 upsert 路径不跑）
  if (startOffset === 0) {
    await sweepDuplicateLiveChromeBookmarkRows()
  }

  // 一次扫描既有活行 chromeBookmarkId；跳过已存在的叶子（防重复导入翻倍）
  // 边界：仅有软删、无活行的叶子仍走 bulk 新建（与 upsert 复活语义不一致；软删 twin 不可见、不进对齐表，不算 bug）
  const existingLiveChromeIds = await listLiveChromeBookmarkIdSet()

  for (
    let offset = startOffset;
    offset < leaves.length;
    offset += MEMORY_ITEM_BULK_IMPORT_BATCH_SIZE
  ) {
    const slice = leaves
      .slice(offset, offset + MEMORY_ITEM_BULK_IMPORT_BATCH_SIZE)
      .filter(leaf => !tombstones.has(leaf.chromeBookmarkId))
      .filter(leaf => !existingLiveChromeIds.has(leaf.chromeBookmarkId))
    if (slice.length > 0) {
      const items = await buildBookmarkItemsFromChromeLeaves(slice)
      await memoryItemRepository.putMany(items)
      for (const item of items) {
        if (item.type === 'bookmark') {
          const chromeId = item.payload.chromeBookmarkId?.trim()
          if (chromeId) {
            existingLiveChromeIds.add(chromeId)
          }
        }
      }
    }
    // 进度仍按 Chrome 叶子扫描位点计（与导入状态机一致），不因墓碑/去重过滤回退
    importedCount = offset + Math.min(MEMORY_ITEM_BULK_IMPORT_BATCH_SIZE, leaves.length - offset)
    if (onBatchComplete) {
      await onBatchComplete(importedCount)
    }
  }

  return importedCount
}

/** 续传导入：逐条 upsert，避免 bulk 中断后重复写入。 */
export async function upsertChromeBookmarkLeaves(
  leaves: ChromeBookmarkLeaf[],
  startOffset = 0,
  onProgress?: (importedCount: number) => Promise<void>
): Promise<number> {
  let importedCount = startOffset

  for (let index = startOffset; index < leaves.length; index += 1) {
    const leaf = leaves[index]
    if (!leaf) {
      continue
    }

    await memoryItemRepository.upsertBookmarkFromChrome({
      payload: {
        title: leaf.title,
        url: leaf.url,
        chromeBookmarkId: leaf.chromeBookmarkId,
        parentFolderId: leaf.parentFolderId,
        chromeCreatedAt: leaf.chromeCreatedAt
      },
      captureEntry: 'sync'
    })

    importedCount = index + 1
    const shouldReport =
      importedCount === leaves.length || importedCount % UPSERT_PROGRESS_INTERVAL === 0
    if (shouldReport && onProgress) {
      await onProgress(importedCount)
    }
  }

  return importedCount
}

/** 读取 chrome.storage 中的导入状态。 */
export async function readChromeBookmarkImportState(): Promise<ChromeBookmarkImportState | null> {
  const raw = await readChromeStorageLocal(
    CHROME_BOOKMARK_IMPORT_STORAGE_KEY,
    ChromeBookmarkImportStateSchema
  )
  if (!raw) {
    return null
  }
  return ChromeBookmarkImportStateSchema.parse(raw)
}

/** 写入导入状态。 */
export async function writeChromeBookmarkImportState(
  state: ChromeBookmarkImportState
): Promise<void> {
  await writeChromeStorageLocal(CHROME_BOOKMARK_IMPORT_STORAGE_KEY, state)
}

/**
 * 清除导入进度（清本机记忆后须调用）。
 * 避免 Memory 已空但仍标 completed，导致 ensure 只 reconcile、冷启动 ready 早退永久漏灌。
 */
export async function clearChromeBookmarkImportState(): Promise<void> {
  await removeChromeStorageLocal(CHROME_BOOKMARK_IMPORT_STORAGE_KEY)
}
