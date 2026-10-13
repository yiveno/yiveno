/** 是否为安装引导演示页（允许保存演示摘录）。 */
export function isGettingStartedPageUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return (
      parsed.protocol === 'chrome-extension:' && parsed.pathname.endsWith('/getting-started.html')
    )
  } catch {
    return false
  }
}

/** 判断 URL 是否可保存为 MemoryItem。 */
export function isSavablePageUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return true
    }
    return isGettingStartedPageUrl(url)
  } catch {
    return false
  }
}
