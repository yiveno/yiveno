/**
 * 检索命中类型判断（纯函数）
 *
 * Cascade 分层（与 filterFlatSearchResults / HybridMerge 一致）：
 * - 第一层：FlexSearch 通道（matchedFields 无 semantic）
 * - Flex 无命中时：语义通道中子串命中的项临时提升为文本层
 * - 第二层：语义通道补位（未在第一层出现的 ID）
 */

import {
  bookmarkMatchesQueryText,
  type BookmarkTextMatchInput
} from '@/core/filter/bookmark-text-match'

/**
 * matchedFields 是否标记为语义通道命中
 */
export function isSemanticChannelHit(matchedFields?: string[]): boolean {
  return (matchedFields ?? []).includes('semantic')
}

/** @deprecated 使用 isSemanticChannelHit */
export function isSemanticSupplementHit(matchedFields?: string[]): boolean {
  return isSemanticChannelHit(matchedFields)
}

/**
 * 结果集中是否存在 FlexSearch 通道命中
 */
export function hasFlexChannelHits(results: Array<{ matchedFields?: string[] }>): boolean {
  return results.some(result => !isSemanticChannelHit(result.matchedFields))
}

/**
 * 是否为第一层（FlexSearch / 文本层）命中
 */
export function isTextLayerSearchHit(
  bookmark: BookmarkTextMatchInput,
  query: string,
  matchedFields: string[] | undefined,
  flexChannelPresent: boolean
): boolean {
  if (!isSemanticChannelHit(matchedFields)) {
    return true
  }

  // Flex 已有命中时，语义通道条目不得挤入文本层（避免与 Flex 重复展示）
  if (flexChannelPresent) {
    return false
  }

  return bookmarkMatchesQueryText(bookmark, query)
}

/**
 * 是否为 Hybrid 第二层语义补位
 */
export function isSemanticSupplementBookmark(
  bookmark: BookmarkTextMatchInput,
  query: string,
  matchedFields?: string[],
  flexChannelPresent = false
): boolean {
  void bookmark
  void query
  if (!isSemanticChannelHit(matchedFields)) {
    return false
  }
  return !isTextLayerSearchHit(bookmark, query, matchedFields, flexChannelPresent)
}
