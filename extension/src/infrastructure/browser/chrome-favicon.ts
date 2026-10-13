/**
 * Chrome 扩展内置 favicon（manifest 需 `favicon` 权限）。
 * 走浏览器已缓存图标，无额外站点请求；未命中时由调用方做 fallback。
 *
 * @see https://developer.chrome.com/docs/extensions/how-to/ui/favicons
 */

const faviconUrlCache = new Map<string, string>()

/** 同站点书签共用 favicon URL，减少重复字符串与 DOM 属性开销。 */
function getFaviconCacheKey(pageUrl: string, size: number): string {
  try {
    return `${new URL(pageUrl).origin}@${size}`
  } catch {
    return `${pageUrl}@${size}`
  }
}

export function getChromeFaviconUrl(pageUrl: string, size = 32): string {
  const cacheKey = getFaviconCacheKey(pageUrl, size)
  const cached = faviconUrlCache.get(cacheKey)
  if (cached) {
    return cached
  }

  const url = new URL(chrome.runtime.getURL('/_favicon/'))
  url.searchParams.set('pageUrl', pageUrl)
  url.searchParams.set('size', String(size))
  const href = url.toString()
  faviconUrlCache.set(cacheKey, href)
  return href
}

/** 测试用：清空模块级 favicon 缓存。 */
export function clearChromeFaviconUrlCacheForTests(): void {
  faviconUrlCache.clear()
}
