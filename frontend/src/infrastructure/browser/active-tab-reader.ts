/** 判断 URL 是否可保存为 MemoryItem。 */
export function isSavablePageUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}
