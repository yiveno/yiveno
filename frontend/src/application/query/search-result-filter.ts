/**
 * 书签检索结果相关性过滤（Application 层）
 *
 * 由 bookmarkSearchService 统一管道调用；入口层不应重复实现过滤逻辑。
 */

import { bookmarkMatchesQueryText } from '@/core/filter/bookmark-text-match'
import type { EnhancedSearchResult } from '@/core/query-engine'
import type { SearchStrategy } from '@/core/query-engine/query-types'

/** 纯语义补充命中的最低分 */
export const SEMANTIC_MIN_SCORE = 0.5
/** 与最高语义分的差距上限（小库避免全员命中） */
const SEMANTIC_SCORE_GAP = 0.06
/** 语义最多补充条数 */
export const SEMANTIC_MAX_EXTRA = 3

/**
 * @deprecated 使用 core/query-engine/hybrid-merge 中的 mergeHybridSearchResults
 */
export { mergeHybridSearchResults } from '@/core/query-engine/hybrid-merge'

/**
 * 从 hybrid 结果中挑选少量高置信语义补充 ID（文本未命中时）
 */
export function pickSemanticSupplementIds(
  results: EnhancedSearchResult[],
  query: string
): Set<string> {
  const ids = new Set<string>()

  const semanticCandidates = results.filter(result => {
    if (bookmarkMatchesQueryText(result.bookmark, query)) {
      return false
    }
    return (result.matchedFields ?? []).includes('semantic')
  })

  if (semanticCandidates.length === 0) {
    return ids
  }

  semanticCandidates.sort((a, b) => b.score - a.score)
  const topScore = semanticCandidates[0]?.score ?? 0
  const scoreThreshold = Math.max(SEMANTIC_MIN_SCORE, topScore - SEMANTIC_SCORE_GAP)

  let added = 0
  for (const result of semanticCandidates) {
    if (result.score < scoreThreshold) {
      break
    }
    ids.add(String(result.bookmark.id))
    added += 1
    if (added >= SEMANTIC_MAX_EXTRA) {
      break
    }
  }

  return ids
}

/**
 * 判断单条检索结果是否与查询相关
 */
export function isRelevantSearchHit(result: EnhancedSearchResult, query: string): boolean {
  if (bookmarkMatchesQueryText(result.bookmark, query)) {
    return true
  }

  const matchedFields = result.matchedFields ?? []
  if (!matchedFields.includes('semantic')) {
    return false
  }

  return result.score >= SEMANTIC_MIN_SCORE
}

/**
 * 过滤扁平检索结果
 *
 * flexsearch：仅文本命中
 * hybrid：文本命中（FlexSearch 层，保持原序）+ 至多 {@link SEMANTIC_MAX_EXTRA} 条纯语义补位
 */
export function filterFlatSearchResults(
  results: EnhancedSearchResult[],
  query: string,
  strategy: SearchStrategy = 'flexsearch'
): EnhancedSearchResult[] {
  const trimmedQuery = query.trim()
  if (!trimmedQuery || results.length === 0) {
    return []
  }

  const textMatches = results.filter(result =>
    bookmarkMatchesQueryText(result.bookmark, trimmedQuery)
  )

  if (strategy !== 'hybrid') {
    return textMatches
  }

  const textMatchIds = new Set(textMatches.map(result => String(result.bookmark.id)))
  const semanticIds = pickSemanticSupplementIds(results, trimmedQuery)
  const semanticMatches = results.filter(result => {
    const id = String(result.bookmark.id)
    return semanticIds.has(id) && !textMatchIds.has(id)
  })

  return [...textMatches, ...semanticMatches]
}
