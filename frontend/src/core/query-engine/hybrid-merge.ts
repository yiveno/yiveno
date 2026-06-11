/**
 * Hybrid 检索合并（Core 层）
 *
 * Cascade 模型：FlexSearch 占第 1 层，Embedding 仅补未命中项；双命中不混合打分、不重复。
 */

import type { EnhancedSearchResult } from './query-types'

/**
 * 合并 FlexSearch 与 Semantic 原始命中
 */
export function mergeHybridSearchResults(
  flexSearchResults: EnhancedSearchResult[],
  semanticResults: EnhancedSearchResult[]
): EnhancedSearchResult[] {
  const flexIds = new Set(flexSearchResults.map(result => String(result.bookmark.id)))

  const semanticOnly = semanticResults.filter(result => !flexIds.has(String(result.bookmark.id)))

  return [...flexSearchResults, ...semanticOnly]
}
