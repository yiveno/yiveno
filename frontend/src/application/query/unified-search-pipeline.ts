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
import { logger } from '@/infrastructure/logging/logger'

const LOG_TAG = 'UnifiedSearchPipeline'

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
  const pipelineStart = performance.now()
  const trimmedQuery = query.trim()
  if (!trimmedQuery) {
    logger.info(LOG_TAG, '空查询，跳过管道', { query })
    return []
  }

  logger.info(LOG_TAG, '▶ 统一结果管道入口', {
    query: trimmedQuery,
    strategy,
    limit,
    rawCount: rawResults.length,
    rawPreview: rawResults.slice(0, 8).map(r => ({
      id: r.bookmark.id,
      title: r.bookmark.title,
      score: Number(r.score.toFixed(4)),
      matchedFields: r.matchedFields ?? []
    }))
  })

  const filterStart = performance.now()
  let relevant = filterFlatSearchResults(rawResults, trimmedQuery, strategy)
  logger.info(LOG_TAG, '相关性过滤完成', {
    query: trimmedQuery,
    strategy,
    rawCount: rawResults.length,
    filteredCount: relevant.length,
    filterDurationMs: Number((performance.now() - filterStart).toFixed(1))
  })

  if (relevant.length === 0) {
    logger.info(LOG_TAG, '过滤无命中，触发 IndexedDB 子串兜底', {
      query: trimmedQuery,
      fallbackLimit: limit
    })
    const fallbackStart = performance.now()
    const fallback = await fetchIndexedDbFallback(trimmedQuery, limit)
    relevant = mapIndexedDbResultsToEnhanced(fallback)
    logger.info(LOG_TAG, 'IndexedDB 兜底完成', {
      query: trimmedQuery,
      fallbackCount: relevant.length,
      fallbackDurationMs: Number((performance.now() - fallbackStart).toFixed(1)),
      fallbackPreview: relevant.slice(0, 8).map(r => ({
        id: r.bookmark.id,
        title: r.bookmark.title,
        score: Number(r.score.toFixed(4))
      }))
    })
  }

  const final = relevant.slice(0, limit)
  logger.info(LOG_TAG, '✅ 统一结果管道出口', {
    query: trimmedQuery,
    strategy,
    beforeLimit: relevant.length,
    finalCount: final.length,
    totalDurationMs: Number((performance.now() - pipelineStart).toFixed(1))
  })

  return final
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
