import type { MemoryItem } from '@/core/memory/memory-item'

/**
 * 计算命中项应打开的地址。
 * 书签 → 原 URL；摘录 → 扩展详情页 `detail.html?id=`。
 *
 * @param detailPageUrl `chrome.runtime.getURL('detail.html')` 或等价绝对路径
 */
export function getMemoryItemOpenHref(
  item: MemoryItem,
  options: { detailPageUrl: string }
): string {
  if (item.type === 'bookmark') {
    return item.payload.url
  }

  const url = new URL(options.detailPageUrl)
  url.searchParams.set('id', item.id)
  return url.href
}

/** 是否为可导航的 http(s) 或扩展详情页 URL。 */
export function tryParseNavigableUrl(text: string): string | null {
  const trimmed = text.trim()
  if (!trimmed) {
    return null
  }

  try {
    const url = new URL(trimmed)
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return url.href
    }
    if (
      url.protocol === 'chrome-extension:' &&
      url.pathname.endsWith('/detail.html') &&
      Boolean(url.searchParams.get('id'))
    ) {
      return url.href
    }
  } catch {
    return null
  }

  return null
}
