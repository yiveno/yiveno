/**
 * 检索命中类型判断（纯函数）
 *
 * 与 filterFlatSearchResults 保持一致：文本子串命中归第一层，其余 semantic 归第二层。
 */

import {
  bookmarkMatchesQueryText,
  type BookmarkTextMatchInput
} from '@/core/filter/bookmark-text-match'

/**
 * matchedFields 是否标记为语义通道命中
 */
export function isSemanticSupplementHit(matchedFields?: string[]): boolean {
  return (matchedFields ?? []).includes('semantic')
}

/**
 * 是否为 Hybrid 第二层语义补位（非文本命中 + semantic 标记）
 */
export function isSemanticSupplementBookmark(
  bookmark: BookmarkTextMatchInput,
  query: string,
  matchedFields?: string[]
): boolean {
  if (bookmarkMatchesQueryText(bookmark, query)) {
    return false
  }
  return isSemanticSupplementHit(matchedFields)
}
