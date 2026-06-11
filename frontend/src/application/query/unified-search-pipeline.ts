/**
 * 统一书签检索结果管道（Application 层）
 *
 * 所有入口（Popup、SidePanel、Management、Omnibox 等）在拿到原始命中后，
 * 必须经过同一套过滤与 IndexedDB 子串兜底，保证同一关键词命中同一批书签。
 */

import { filterFlatSearchResults } from '@/application/query/search-result-filter'
import type { EnhancedSearchResult } from '@/core/query-engine'
import type { SearchResult } from '@/infrastructure/indexeddb/manager'
import type { SearchStrategy } from '@/types/domain/query'

/** IndexedDB 子串兜底查询 */
export type IndexedDbSearchFallback = (query: string, limit: number) => Promise<SearchResult[]>

function mapIndexedDbResultsToEnhanced(results: SearchResult[]): EnhancedSearchResult[] {
  return results.map(item => ({
    bookmark: item.bookmark,
    score: item.score,
    pathString: item.bookmark.pathString,
    matchedFields: [],
    highlights: {}
  }))
}

/**
 * 将原始检索命中规范化为最终展示/裁剪用的统一结果集
 */
export async function finalizeBookmarkSearchResults(
  query: string,
  rawResults: EnhancedSearchResult[],
  strategy: SearchStrategy,
  limit: number,
  fetchIndexedDbFallback: IndexedDbSearchFallback
): Promise<EnhancedSearchResult[]> {
  const trimmedQuery = query.trim()
  if (!trimmedQuery) {
    return []
  }

  let relevant = filterFlatSearchResults(rawResults, trimmedQuery, strategy)

  if (relevant.length === 0) {
    const fallback = await fetchIndexedDbFallback(trimmedQuery, limit)
    relevant = mapIndexedDbResultsToEnhanced(fallback)
  }

  return relevant.slice(0, limit)
}

/**
 * 从统一检索结果提取书签 ID 集合（Management 树裁剪等场景）
 */
export function collectBookmarkIdsFromSearchResults(results: EnhancedSearchResult[]): Set<string> {
  const ids = new Set<string>()
  for (const result of results) {
    if (result.bookmark.url) {
      ids.add(String(result.bookmark.id))
    }
  }
  return ids
}
