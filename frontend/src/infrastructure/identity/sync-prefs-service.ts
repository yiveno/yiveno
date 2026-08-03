import {
  createDefaultSyncPrefs,
  SYNC_PREFS_STORAGE_KEY,
  SyncPrefsSchema,
  type SyncPrefs
} from '@/core/identity/sync-prefs'
import {
  readChromeStorageLocal,
  writeChromeStorageLocal
} from '@/infrastructure/storage/chrome-storage-local'

/** 读取同步偏好；缺失时返回默认（enabled=false）。 */
export async function getSyncPrefs(): Promise<SyncPrefs> {
  const existing = await readChromeStorageLocal(SYNC_PREFS_STORAGE_KEY, SyncPrefsSchema)
  return existing ?? createDefaultSyncPrefs()
}

/** 写入同步偏好（整对象替换）。 */
export async function setSyncPrefs(prefs: SyncPrefs): Promise<void> {
  const parsed = SyncPrefsSchema.parse(prefs)
  await writeChromeStorageLocal(SYNC_PREFS_STORAGE_KEY, parsed)
}

/** 局部更新同步偏好。 */
export async function patchSyncPrefs(patch: Partial<SyncPrefs>): Promise<SyncPrefs> {
  const current = await getSyncPrefs()
  const next = SyncPrefsSchema.parse({ ...current, ...patch })
  await setSyncPrefs(next)
  return next
}
