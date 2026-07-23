import {
  CHROME_BOOKMARK_IMPORT_STORAGE_KEY,
  ChromeBookmarkImportStateSchema,
  type ChromeBookmarkImportState
} from '@/core/memory/chrome-bookmark-import-state'
import { createBookmarkMemoryItem } from '@/core/memory/create-memory-item'
import type { ChromeBookmarkLeaf } from '@/infrastructure/browser/chrome-bookmark-reader'
import { MEMORY_ITEM_BULK_IMPORT_BATCH_SIZE } from '@/infrastructure/indexeddb/constants'
import {
  getCurrentOwnerId,
  getOrCreateLocalProfile
} from '@/infrastructure/identity/local-profile-service'
import { memoryItemRepository } from '@/infrastructure/indexeddb/memory-item-repository'
import {
  readChromeStorageLocal,
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

/** 批量写入 Chrome 书签叶子（单事务 per batch）。 */
export async function bulkPutChromeBookmarkLeaves(
  leaves: ChromeBookmarkLeaf[],
  startOffset = 0,
  onBatchComplete?: (importedCount: number) => Promise<void>
): Promise<number> {
  let importedCount = startOffset

  for (
    let offset = startOffset;
    offset < leaves.length;
    offset += MEMORY_ITEM_BULK_IMPORT_BATCH_SIZE
  ) {
    const slice = leaves.slice(offset, offset + MEMORY_ITEM_BULK_IMPORT_BATCH_SIZE)
    const items = await buildBookmarkItemsFromChromeLeaves(slice)
    await memoryItemRepository.putMany(items)
    importedCount = offset + slice.length
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
