import type { SupportedMemoryItemType } from '@/core/memory/memory-item-type'

/** 记忆库左侧类型 Tab。 */
export interface LibraryTypeTab {
  type: SupportedMemoryItemType
  label: string
  emptyTitle: string
  emptyBody: string
}

/** 默认选中书签。 */
export const DEFAULT_LIBRARY_TYPE: SupportedMemoryItemType = 'bookmark'

/** URL 查询参数：记忆库类型 Tab（刷新后恢复）。 */
export const LIBRARY_TYPE_QUERY_KEY = 'type'

/** 记忆库类型 Tab 定义（顺序即侧栏顺序）。 */
export const LIBRARY_TYPE_TABS: readonly LibraryTypeTab[] = [
  {
    type: 'bookmark',
    label: '书签',
    emptyTitle: '还没有书签',
    emptyBody: '用 Chrome 加书签后会出现在目录树中；同步到 Yiveno 后可用于找回。'
  },
  {
    type: 'text_excerpt',
    label: '摘录',
    emptyTitle: '还没有文字摘录',
    emptyBody: '在网页划词保存，或右键「保存到 Yiveno」后，会出现在这里。'
  }
] as const

/** 解析 Tab；非法值回退默认书签。 */
export function resolveLibraryTypeTab(type: string | null | undefined): LibraryTypeTab {
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
 * 默认书签时去掉 type，避免多余 `?type=bookmark`。
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
