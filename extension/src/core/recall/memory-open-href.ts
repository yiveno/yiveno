import type { MemoryItem } from '@/core/memory/memory-item'

/** Omnibox 建议 content 用的占位页名（不落盘；仅在 onInputEntered 解析 id）。 */
export const OMNIBOX_OPEN_HTML = 'omnibox-open.html'

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

/**
 * Omnibox 建议的 content：一律带 Memory id，便于选中后写 openCount。
 * 书签用 `omnibox-open.html?id=`（SW 解析后改开真实 URL）；摘录仍用详情页。
 */
export function getOmniboxSuggestContent(
  item: MemoryItem,
  options: { detailPageUrl: string }
): string {
  if (item.type === 'text_excerpt') {
    return getMemoryItemOpenHref(item, options)
  }

  const url = new URL(options.detailPageUrl)
  url.pathname = url.pathname.replace(/[^/]+$/, OMNIBOX_OPEN_HTML)
  url.search = ''
  url.hash = ''
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
 * 从 Omnibox 书签占位 content 解析 MemoryItem id。
 * `omnibox-open.html?id=`；非占位则 null。
 */
export function tryParseOmniboxOpenMemoryId(text: string): string | null {
  const trimmed = text.trim()
  if (!trimmed) {
    return null
  }

  try {
    const url = new URL(trimmed)
    if (url.protocol !== 'chrome-extension:' || !url.pathname.endsWith(`/${OMNIBOX_OPEN_HTML}`)) {
      return null
    }
    const id = url.searchParams.get('id')?.trim()
    return id && id.length > 0 ? id : null
  } catch {
    return null
  }
}

/**
 * 从打开地址解析 MemoryItem id。
 * 详情页 `detail.html?id=` 或 Omnibox 占位 `omnibox-open.html?id=`；书签直链无 id。
 */
export function tryParseMemoryItemIdFromOpenHref(text: string): string | null {
  const omniboxId = tryParseOmniboxOpenMemoryId(text)
  if (omniboxId) {
    return omniboxId
  }

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
