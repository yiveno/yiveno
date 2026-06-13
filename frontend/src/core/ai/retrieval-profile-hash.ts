/**
 * 检索 Profile 源文本哈希（Core 层）
 */

/** 根据 title + url 生成 Profile 失效检测键 */
export function buildRetrievalProfileSourceHash(title: string, url: string): string {
  return `${title.trim().toLowerCase()}|${url.trim().toLowerCase()}`
}

/**
 * 书签是否需要（重新）生成检索 Profile
 */
export function bookmarkNeedsRetrievalProfile(
  bookmark: {
    url?: string | null | undefined
    isFolder?: boolean | null | undefined
    title?: string | null | undefined
    retrievalProfile?: string | null | undefined
    retrievalProfileSourceHash?: string | null | undefined
    retrievalProfileVersion?: number | null | undefined
  },
  contentVersion: number
): boolean {
  if (!bookmark.url || bookmark.isFolder) {
    return false
  }

  const title = bookmark.title?.trim() ?? ''
  const url = bookmark.url.trim()
  if (!title || !url) {
    return false
  }

  const currentHash = buildRetrievalProfileSourceHash(title, url)
  if (!bookmark.retrievalProfile?.trim()) {
    return true
  }

  if (bookmark.retrievalProfileSourceHash !== currentHash) {
    return true
  }

  return (bookmark.retrievalProfileVersion ?? 0) < contentVersion
}
