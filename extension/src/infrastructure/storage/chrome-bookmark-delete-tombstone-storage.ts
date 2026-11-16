import {
  CHROME_BOOKMARK_TOMBSTONE_STORAGE_KEY,
  ChromeBookmarkDeleteTombstoneStateSchema,
  type ChromeBookmarkDeleteTombstoneState
} from '@/core/memory/chrome-bookmark-delete-tombstone'
import {
  readChromeStorageLocal,
  writeChromeStorageLocal
} from '@/infrastructure/storage/chrome-storage-local'

/** 读取墓碑集合；损坏或缺省时返回空集。 */
export async function readChromeBookmarkDeleteTombstoneIds(): Promise<ReadonlySet<string>> {
  const state = await readChromeStorageLocal(
    CHROME_BOOKMARK_TOMBSTONE_STORAGE_KEY,
    ChromeBookmarkDeleteTombstoneStateSchema
  )
  if (!state) {
    return new Set()
  }
  return new Set(state.chromeBookmarkIds)
}

/** 将单个 chromeBookmarkId 记入墓碑（幂等）。 */
export async function addChromeBookmarkDeleteTombstone(chromeBookmarkId: string): Promise<void> {
  const id = chromeBookmarkId.trim()
  if (!id) {
    return
  }
  const existing = await readChromeBookmarkDeleteTombstoneIds()
  if (existing.has(id)) {
    return
  }
  const next: ChromeBookmarkDeleteTombstoneState = {
    chromeBookmarkIds: [...existing, id]
  }
  await writeChromeStorageLocal(CHROME_BOOKMARK_TOMBSTONE_STORAGE_KEY, next)
}
