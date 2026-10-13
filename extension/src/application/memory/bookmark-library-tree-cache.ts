import type { BookmarkLibraryIndex } from '@/core/memory/bookmark-library-index'

/** SW 侧最近一次构建的索引与 hash，供 unchanged 短路。 */
let lastBuiltIndex: BookmarkLibraryIndex | null = null
let lastBuiltHash: string | null = null

export function rememberBookmarkLibraryTreeBuild(
  index: BookmarkLibraryIndex,
  structureHash: string
): void {
  lastBuiltIndex = index
  lastBuiltHash = structureHash
}

export function getLastBuiltBookmarkLibraryTree(): {
  index: BookmarkLibraryIndex
  structureHash: string
} | null {
  if (!lastBuiltIndex || !lastBuiltHash) {
    return null
  }
  return { index: lastBuiltIndex, structureHash: lastBuiltHash }
}

export function invalidateBookmarkLibraryTreeCache(): void {
  lastBuiltIndex = null
  lastBuiltHash = null
}
