import type { SupportedMemoryItemType } from '@/core/memory/memory-item-type'

/** 记忆库 Tab 文案 key（由 UI `t()` 解析；core 不依赖 chrome）。 */
export interface LibraryTypeTabDef {
  type: SupportedMemoryItemType
  labelKey: 'library_tab_bookmarks' | 'library_tab_excerpts'
  emptyTitleKey: 'library_empty_bookmarks_title' | 'library_empty_excerpts_title'
  emptyBodyKey: 'library_empty_bookmarks_body' | 'library_empty_excerpts_body'
}

/** 默认选中摘录（核心资产主角；书签为配角）。 */
export const DEFAULT_LIBRARY_TYPE: SupportedMemoryItemType = 'text_excerpt'

/** URL 查询参数：记忆库类型 Tab（刷新后恢复）。 */
export const LIBRARY_TYPE_QUERY_KEY = 'type'

/** 记忆库类型 Tab 定义（顺序即侧栏顺序：摘录优先）。 */
export const LIBRARY_TYPE_TABS: readonly LibraryTypeTabDef[] = [
  {
    type: 'text_excerpt',
    labelKey: 'library_tab_excerpts',
    emptyTitleKey: 'library_empty_excerpts_title',
    emptyBodyKey: 'library_empty_excerpts_body'
  },
  {
    type: 'bookmark',
    labelKey: 'library_tab_bookmarks',
    emptyTitleKey: 'library_empty_bookmarks_title',
    emptyBodyKey: 'library_empty_bookmarks_body'
  }
] as const

/** 解析 Tab 定义；非法值回退默认摘录。 */
export function resolveLibraryTypeTab(type: string | null | undefined): LibraryTypeTabDef {
  const found = LIBRARY_TYPE_TABS.find(tab => tab.type === type)
  return found ?? LIBRARY_TYPE_TABS[0]!
}

/** 从 location.search 解析类型 Tab。 */
export function parseLibraryTypeFromLocationSearch(search: string): SupportedMemoryItemType {
  const normalized = search.startsWith('?') ? search.slice(1) : search
  const value = new URLSearchParams(normalized).get(LIBRARY_TYPE_QUERY_KEY)
  return resolveLibraryTypeTab(value).type
}

/**
 * 将类型 Tab 写入 search 字符串。
 * 默认摘录时去掉 type，避免多余 `?type=text_excerpt`。
 */
export function buildLibraryTypeLocationSearch(
  type: SupportedMemoryItemType,
  currentSearch = ''
): string {
  const normalized = currentSearch.startsWith('?') ? currentSearch.slice(1) : currentSearch
  const params = new URLSearchParams(normalized)
  if (type === DEFAULT_LIBRARY_TYPE) {
    params.delete(LIBRARY_TYPE_QUERY_KEY)
  } else {
    params.set(LIBRARY_TYPE_QUERY_KEY, type)
  }
  const query = params.toString()
  return query ? `?${query}` : ''
}

/** 单次列表拉取上限。 */
export const LIBRARY_LIST_LIMIT = 200
