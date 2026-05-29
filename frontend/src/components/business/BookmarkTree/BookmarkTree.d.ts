// 新增类型定义文件
import type { BookmarkNode } from '@/types'

export type SimpleBookmarkTreeSource = 'sidePanel' | 'management'

// ✅ 选择模式支持布尔或显式 'single'/'multiple'
export type SimpleBookmarkTreeSelectable = boolean | 'single' | 'multiple'

export interface SimpleBookmarkTreeVirtualOptions {
  enabled: boolean
  itemHeight?: number | undefined
  threshold?: number | undefined
}

// ✅ defineExpose 暴露给父组件的能力集合
export interface SimpleBookmarkTreeExpose {
  expandAll(): void
  collapseAll(): void
  clearSelection(): void
  expandedFolders: Set<string>
  selectedNodes: Set<string>
  focusNodeById(
    id: string,
    options?: {
      scrollIntoView?: boolean
      collapseOthers?: boolean | undefined
      scrollIntoViewCenter?: boolean | undefined
      pathIds?: string[] | undefined
    }
  ): Promise<void>
  activeNodeId: string | undefined
  expandFolderById(id: string): void
  collapseFolderById(id: string): void
  toggleFolderById(id: string): void
  selectNodeById(id: string, opts?: { append?: boolean }): void
  selectNodesByIds(ids: string[], opts?: { append?: boolean }): void
  getFirstVisibleBookmarkId(): string | undefined
  searchQuery: string
  setSearchQuery(query: string): void
  isScrolling: boolean
}

// ✅ 组件 Props：中文注释解释业务语义
export interface SimpleBookmarkTreeProps {
  nodes?: BookmarkNode[] | undefined
  loading?: boolean | undefined
  height?: string | number | undefined
  searchable?: boolean | undefined
  selectable?: SimpleBookmarkTreeSelectable | undefined
  editable?: boolean | undefined
  strictChromeOrder?: boolean | undefined
  virtual?: boolean | SimpleBookmarkTreeVirtualOptions | undefined
  size?: 'compact' | 'comfortable' | 'spacious' | undefined
  showToolbar?: boolean | undefined
  toolbarExpandCollapse?: boolean | undefined
  source?: SimpleBookmarkTreeSource | undefined
  highlightMatches?: boolean | undefined
  showSelectionCheckbox?: boolean | undefined
  loadingChildren?: Set<string> | undefined
  selectedDescCounts?: Map<string, number> | undefined
}

// ✅ 组件 Emits：列出所有事件供 TS 推断
export interface SimpleBookmarkTreeEmits {
  (event: 'nodeClick', node: BookmarkNode, e: MouseEvent): void
  (event: 'folderToggle', folderId: string, node: BookmarkNode, expanded: boolean): void
  (event: 'nodeSelect', nodeId: string, node: BookmarkNode, selected: boolean): void
  (event: 'selectionChange', ids: string[], nodes: BookmarkNode[]): void
  (event: 'search', query: string): void
  (event: 'ready'): void
  (event: 'nodeEdit', node: BookmarkNode): void
  (event: 'nodeDelete', node: BookmarkNode): void
  (event: 'folderAdd', parent: BookmarkNode): void
  (event: 'bookmarkOpenNewTab', node: BookmarkNode): void
  (event: 'bookmarkCopyUrl', node: BookmarkNode): void
  (event: 'expandStateChange', expanded: boolean): void
  (
    event: 'requestChildren',
    payload: {
      folderId: string
      node: BookmarkNode
      limit: number
      offset: number
    }
  ): void
  (
    event: 'requestMoreChildren',
    payload: {
      folderId: string
      node: BookmarkNode
      limit: number
      loaded: number
    }
  ): void
  (event: 'bookmarkToggleFavorite', node: BookmarkNode): void
  (event: 'folderShare', node: BookmarkNode): void
  (event: 'bookmarkShare', node: BookmarkNode): void
  (event: 'bookmarkMove', node: BookmarkNode): void
  (event: 'descCountsUpdated', counts: Map<string, number>): void
}
