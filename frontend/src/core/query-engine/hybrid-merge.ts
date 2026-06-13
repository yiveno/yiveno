/**
 * Hybrid 检索合并（Core 层）
 *
 * Cascade 模型：FlexSearch 占第 1 层，Embedding 仅补未命中项；双命中不混合打分、不重复。
 */

import type { EnhancedSearchResult } from './query-types'

function formatBrief(result: EnhancedSearchResult) {
  return {
    id: result.bookmark.id,
    title: result.bookmark.title,
    score: Number(result.score.toFixed(4)),
    matchedFields: result.matchedFields ?? []
  }
}

/**
 * 合并 FlexSearch 与 Semantic 原始命中
 */
export function mergeHybridSearchResults(
  flexSearchResults: EnhancedSearchResult[],
  semanticResults: EnhancedSearchResult[]
): EnhancedSearchResult[] {
  const flexIds = new Set(flexSearchResults.map(result => String(result.bookmark.id)))

  const semanticOnly = semanticResults.filter(result => !flexIds.has(String(result.bookmark.id)))
  const dedupedCount = semanticResults.length - semanticOnly.length

  const merged = [...flexSearchResults, ...semanticOnly]

  // 使用 console 避免 Core 层依赖 Infrastructure logger
  if (typeof console !== 'undefined') {
    console.info('[HybridMerge] 合并完成', {
      flexCount: flexSearchResults.length,
      semanticInputCount: semanticResults.length,
      semanticDeduped: dedupedCount,
      semanticOnlyCount: semanticOnly.length,
      mergedCount: merged.length,
      flexTop: flexSearchResults.slice(0, 5).map(formatBrief),
      semanticOnlyTop: semanticOnly.slice(0, 5).map(formatBrief)
    })
  }

  return merged
}
