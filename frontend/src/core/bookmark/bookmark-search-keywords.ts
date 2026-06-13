/**
 * 书签 FlexSearch 关键词合并（Core 层纯函数）
 */

/** 合并用户关键词与 LLM 检索词，供 FlexSearch / Worker 索引 */
export function buildBookmarkSearchKeywords(bookmark: {
  keywords?: string[] | null | undefined
  retrievalKeywords?: string[] | null | undefined
}): string[] {
  const merged: string[] = []
  const seen = new Set<string>()

  for (const keyword of [...(bookmark.keywords ?? []), ...(bookmark.retrievalKeywords ?? [])]) {
    const normalized = keyword.trim().toLowerCase()
    if (!normalized || seen.has(normalized)) {
      continue
    }
    seen.add(normalized)
    merged.push(normalized)
  }

  return merged
}

/** FlexSearch 索引用空格拼接关键词 */
export function formatBookmarkSearchKeywordsText(bookmark: {
  keywords?: string[] | null | undefined
  retrievalKeywords?: string[] | null | undefined
}): string {
  return buildBookmarkSearchKeywords(bookmark).join(' ')
}
