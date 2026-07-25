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

/**
 * 从打开地址解析 MemoryItem id。
 * 仅详情页 `detail.html?id=` 可解析；书签直链无 id。
 */
export function tryParseMemoryItemIdFromOpenHref(text: string): string | null {
  const navigable = tryParseNavigableUrl(text)
  if (!navigable) {
    return null
  }

  try {
    const url = new URL(navigable)
    if (url.protocol === 'chrome-extension:' && url.pathname.endsWith('/detail.html')) {
      const id = url.searchParams.get('id')?.trim()
      return id && id.length > 0 ? id : null
    }
  } catch {
    return null
  }

  return null
}
