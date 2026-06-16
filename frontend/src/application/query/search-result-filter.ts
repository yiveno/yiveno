/**
 * 书签检索结果相关性过滤（Application 层）
 *
 * 由 bookmarkSearchService 统一管道调用；入口层不应重复实现过滤逻辑。
 */

import { bookmarkMatchesQueryText } from '@/core/filter/bookmark-text-match'
import {
  passesSemanticConfidenceGate,
  pickTopScoredWithinBand,
  SEMANTIC_CONFIDENCE_MIN_SCORE,
  SEMANTIC_DIRECT_MIN_GAP,
  SEMANTIC_SUPPLEMENT_MIN_GAP,
  SEMANTIC_SUPPLEMENT_SCORE_BAND,
  SEMANTIC_VECTOR_RECALL_MIN_SCORE
} from '@/core/filter/semantic-confidence'
import { hasAdequateSemanticQueryLength } from '@/core/filter/semantic-query-signal'
import {
  hasFlexChannelHits,
  isSemanticChannelHit,
  isTextLayerSearchHit
} from '@/core/filter/search-hit-kind'
import type { EnhancedSearchResult } from '@/core/query-engine'
import type { SearchStrategy } from '@/core/query-engine/query-types'
import { logger } from '@/infrastructure/logging/logger'

const LOG_TAG = 'SearchResultFilter'

/** Embedding 向量召回下限（宽召回，最终展示由 pick* 裁切） */
export const SEMANTIC_VECTOR_MIN_SCORE = SEMANTIC_VECTOR_RECALL_MIN_SCORE
/** 语义最多补充条数 */
export const SEMANTIC_MAX_EXTRA = 2
/** 无文本命中时最多展示的语义直达条数 */
const SEMANTIC_DIRECT_MAX = 1

function formatCandidate(result: EnhancedSearchResult) {
  return {
    id: result.bookmark.id,
    title: result.bookmark.title,
    url: result.bookmark.url,
    score: Number(result.score.toFixed(4)),
    matchedFields: result.matchedFields ?? [],
    textMatched: false
  }
}

function getSemanticCandidates(
  results: EnhancedSearchResult[],
  excludedIds: ReadonlySet<string>
): EnhancedSearchResult[] {
  return results
    .filter(result => {
      const id = String(result.bookmark.id)
      if (excludedIds.has(id)) {
        return false
      }
      return isSemanticChannelHit(result.matchedFields)
    })
    .sort((a, b) => b.score - a.score)
}

/**
 * 提取第一层（FlexSearch 通道）命中，保持 merge 后的原序
 */
function getTextLayerHits(results: EnhancedSearchResult[], query: string): EnhancedSearchResult[] {
  const flexChannelPresent = hasFlexChannelHits(results)
  return results.filter(result =>
    isTextLayerSearchHit(result.bookmark, query, result.matchedFields, flexChannelPresent)
  )
}

/**
 * 从 hybrid 结果中挑选少量高置信语义候选 ID
 *
 * 文本层已有命中时启用；过短查询或置信不足时不强行补位。
 */
export function pickSemanticSupplementIds(
  results: EnhancedSearchResult[],
  query: string,
  excludedIds: ReadonlySet<string> = new Set()
): Set<string> {
  const ids = new Set<string>()

  if (!hasAdequateSemanticQueryLength(query)) {
    logger.info(LOG_TAG, '语义补位跳过：查询过短', {
      query,
      minGraphemes: 2
    })
    return ids
  }

  const semanticCandidates = getSemanticCandidates(results, excludedIds)

  if (semanticCandidates.length === 0) {
    logger.info(LOG_TAG, '语义补位跳过：无纯语义候选', {
      query,
      rawCount: results.length
    })
    return ids
  }

  if (
    !passesSemanticConfidenceGate(
      semanticCandidates,
      SEMANTIC_CONFIDENCE_MIN_SCORE,
      SEMANTIC_SUPPLEMENT_MIN_GAP
    )
  ) {
    logger.info(LOG_TAG, '语义补位淘汰：置信不足（分数或领先幅度）', {
      query,
      minScore: SEMANTIC_CONFIDENCE_MIN_SCORE,
      minGap: SEMANTIC_SUPPLEMENT_MIN_GAP,
      candidates: semanticCandidates.slice(0, 5).map(formatCandidate)
    })
    return ids
  }

  const picked = pickTopScoredWithinBand(
    semanticCandidates,
    SEMANTIC_CONFIDENCE_MIN_SCORE,
    SEMANTIC_SUPPLEMENT_SCORE_BAND,
    SEMANTIC_MAX_EXTRA
  )

  for (const result of picked) {
    ids.add(String(result.bookmark.id))
  }

  logger.info(LOG_TAG, '语义补位通过', {
    query,
    topScore: Number((semanticCandidates[0]?.score ?? 0).toFixed(4)),
    ids: Array.from(ids),
    candidates: semanticCandidates.slice(0, 5).map(formatCandidate)
  })

  return ids
}

/**
 * 无文本命中时，仅允许明显领先的高置信语义结果直达。
 *
 * Embedding 对任意输入都会返回最近邻；领先幅度用于过滤随机文本造成的密集误召回。
 */
export function pickSemanticDirectIds(
  results: EnhancedSearchResult[],
  query: string,
  excludedIds: ReadonlySet<string> = new Set()
): Set<string> {
  const ids = new Set<string>()

  const semanticCandidates = getSemanticCandidates(results, excludedIds)

  if (
    !passesSemanticConfidenceGate(
      semanticCandidates,
      SEMANTIC_CONFIDENCE_MIN_SCORE,
      SEMANTIC_DIRECT_MIN_GAP
    )
  ) {
    logger.info(LOG_TAG, '语义直达淘汰：置信不足（分数或领先幅度）', {
      query,
      minScore: SEMANTIC_CONFIDENCE_MIN_SCORE,
      minGap: SEMANTIC_DIRECT_MIN_GAP,
      topCandidate: semanticCandidates[0] ? formatCandidate(semanticCandidates[0]) : null,
      candidates: semanticCandidates.slice(0, 5).map(formatCandidate)
    })
    return ids
  }

  const picked = pickTopScoredWithinBand(
    semanticCandidates,
    SEMANTIC_CONFIDENCE_MIN_SCORE,
    SEMANTIC_SUPPLEMENT_SCORE_BAND,
    SEMANTIC_DIRECT_MAX
  )

  for (const result of picked) {
    ids.add(String(result.bookmark.id))
  }

  logger.info(LOG_TAG, '语义直达通过', {
    query,
    ids: Array.from(ids),
    candidates: semanticCandidates.slice(0, 5).map(formatCandidate)
  })

  return ids
}

/**
 * 过滤扁平检索结果
 *
 * flexsearch：仅文本命中
 * hybrid：文本命中（FlexSearch 层，保持原序）+ 语义直达/补位
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

  if (strategy !== 'hybrid') {
    const textMatches = results.filter(result =>
      bookmarkMatchesQueryText(result.bookmark, trimmedQuery)
    )
    logger.info(LOG_TAG, '结果过滤完成：flexsearch', {
      query: trimmedQuery,
      rawCount: results.length,
      textCount: textMatches.length,
      textPreview: textMatches.slice(0, 8).map(formatCandidate)
    })
    return textMatches
  }

  const textLayerHits = getTextLayerHits(results, trimmedQuery)

  if (textLayerHits.length === 0) {
    const semanticDirectIds = pickSemanticDirectIds(results, trimmedQuery)
    const semanticDirectMatches = results.filter(result =>
      semanticDirectIds.has(String(result.bookmark.id))
    )
    logger.info(LOG_TAG, '结果过滤完成：hybrid 无文本命中', {
      query: trimmedQuery,
      rawCount: results.length,
      directCount: semanticDirectMatches.length,
      directIds: Array.from(semanticDirectIds),
      rawCandidates: results.slice(0, 8).map(result => ({
        ...formatCandidate(result),
        textMatched: bookmarkMatchesQueryText(result.bookmark, trimmedQuery)
      }))
    })
    return semanticDirectMatches
  }

  const textLayerIds = new Set(textLayerHits.map(result => String(result.bookmark.id)))
  const semanticIds = pickSemanticSupplementIds(results, trimmedQuery, textLayerIds)
  const semanticMatches = results.filter(result => {
    const id = String(result.bookmark.id)
    return semanticIds.has(id) && !textLayerIds.has(id)
  })

  const filtered = dedupeSearchResultsByBookmarkId([...textLayerHits, ...semanticMatches])
  logger.info(LOG_TAG, '结果过滤完成：hybrid 文本命中补位', {
    query: trimmedQuery,
    rawCount: results.length,
    textLayerCount: textLayerHits.length,
    textLayerIds: Array.from(textLayerIds),
    semanticExtraCount: semanticMatches.length,
    semanticExtraIds: semanticMatches.map(result => String(result.bookmark.id)),
    finalCount: filtered.length
  })

  return filtered
}

/**
 * 按书签 ID 去重，优先保留 FlexSearch 通道条目
 */
function dedupeSearchResultsByBookmarkId(results: EnhancedSearchResult[]): EnhancedSearchResult[] {
  const seen = new Set<string>()
  const deduped: EnhancedSearchResult[] = []

  for (const result of results) {
    const id = String(result.bookmark.id)
    if (seen.has(id)) {
      continue
    }
    seen.add(id)
    deduped.push(result)
  }

  return deduped
}
