import type { InjectionKey, ShallowRef } from 'vue'

/** 书签树展开状态：由根组件 provide，节点 inject，避免每节点独立 ref + watch。 */
export interface BookmarkLibraryTreeContext {
  expandedFolderIds: ShallowRef<Set<string> | null>
  toggleFolder: (chromeId: string, depth: number) => void
}

export const bookmarkLibraryTreeContextKey: InjectionKey<BookmarkLibraryTreeContext> = Symbol(
  'bookmarkLibraryTreeContext'
)

/** 解析文件夹是否展开：null 表示尚未 hydration，沿用 depth<1 默认。 */
export function resolveBookmarkFolderExpanded(
  expandedFolderIds: Set<string> | null,
  chromeId: string,
  depth: number
): boolean {
  if (expandedFolderIds === null) {
    return depth < 1
  }
  return expandedFolderIds.has(chromeId)
}
