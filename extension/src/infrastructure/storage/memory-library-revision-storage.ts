/**
 * 本机 Memory 库成员变更信号（chrome.storage.local）。
 * 供可见 UI（如 Side Panel 空态）经 `storage.onChanged` 重探；非全库总线。
 */

export const MEMORY_LIBRARY_REVISION_LOCAL_KEY = 'yiveno.memoryLibraryRevision'

async function readMemoryLibraryRevision(): Promise<number> {
  const result = await chrome.storage.local.get(MEMORY_LIBRARY_REVISION_LOCAL_KEY)
  const value = result[MEMORY_LIBRARY_REVISION_LOCAL_KEY]
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0
}

/** 划存 / 删除 / 清库等改变「库是否为空」后 +1，供可见壳重探。 */
export async function bumpMemoryLibraryRevision(): Promise<number> {
  const next = (await readMemoryLibraryRevision()) + 1
  await chrome.storage.local.set({ [MEMORY_LIBRARY_REVISION_LOCAL_KEY]: next })
  return next
}
