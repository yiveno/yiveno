/** 文本子串匹配所需的书签字段（UI 节点可能仅含部分字段） */
export interface BookmarkTextMatchInput {
  title?: string | null | undefined
  url?: string | null | undefined
  domain?: string | null | undefined
  titleLower?: string | null | undefined
  urlLower?: string | null | undefined
  keywords?: string[] | null | undefined
  retrievalKeywords?: string[] | null | undefined
  retrievalProfile?: string | null | undefined
  tags?: string[] | null | undefined
}

/**
 * 判断书签是否在标题、URL、域名等字段中包含查询文本（子串匹配，支持中文）
 */
export function bookmarkMatchesQueryText(bookmark: BookmarkTextMatchInput, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return false

  const title = (bookmark.title ?? '').toLowerCase()
  const url = (bookmark.url ?? '').toLowerCase()
  const domain = (bookmark.domain ?? '').toLowerCase()
  const titleLower = (bookmark.titleLower ?? title).toLowerCase()
  const urlLower = (bookmark.urlLower ?? url).toLowerCase()

  const profile = (bookmark.retrievalProfile ?? '').toLowerCase()

  return (
    title.includes(normalizedQuery) ||
    url.includes(normalizedQuery) ||
    domain.includes(normalizedQuery) ||
    titleLower.includes(normalizedQuery) ||
    urlLower.includes(normalizedQuery) ||
    profile.includes(normalizedQuery) ||
    (bookmark.keywords ?? []).some(keyword => keyword.toLowerCase().includes(normalizedQuery)) ||
    (bookmark.retrievalKeywords ?? []).some(keyword =>
      keyword.toLowerCase().includes(normalizedQuery)
    ) ||
    (bookmark.tags ?? []).some(tag => tag.toLowerCase().includes(normalizedQuery))
  )
}
