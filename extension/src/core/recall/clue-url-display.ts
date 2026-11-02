/**
 * Composer URL 芯片展示：对齐键、标题截断、最终 label。
 * core 纯函数；SW / UI 共用。不联网抓页。
 */

/**
 * 芯片可见文案病态安全上限（字符）。
 * 日常截断靠 CSS max-width + ellipsis；此处防超长标题撑爆无样式环境。
 */
export const CLUE_URL_DISPLAY_MAX_CHARS = 28

/**
 * 粘贴 URL ↔ 书签/摘录/标签对齐键：小写 host、去 www、去 hash、非根 path 去尾 `/`。
 */
export function clueUrlLookupKey(href: string): string {
  try {
    const url = new URL(href)
    url.hash = ''
    url.username = ''
    url.password = ''
    url.hostname = url.hostname.replace(/^www\./i, '').toLowerCase()
    if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
      url.pathname = url.pathname.slice(0, -1)
    }
    return url.href
  } catch {
    return href.trim()
  }
}

/**
 * 芯片可见文案：去 www. 的 host + 截断 path/query。
 */
export function formatClueUrlDisplayLabel(href: string): string {
  try {
    const url = new URL(href)
    const host = url.hostname.replace(/^www\./i, '')
    if (!host) {
      return href.slice(0, CLUE_URL_DISPLAY_MAX_CHARS)
    }
    let rest = `${url.pathname || ''}${url.search || ''}${url.hash || ''}`
    if (rest === '/') {
      rest = ''
    }
    const full = `${host}${rest}`
    if (full.length <= CLUE_URL_DISPLAY_MAX_CHARS) {
      return full
    }
    return `${full.slice(0, CLUE_URL_DISPLAY_MAX_CHARS - 1)}…`
  } catch {
    return href.length <= CLUE_URL_DISPLAY_MAX_CHARS
      ? href
      : `${href.slice(0, CLUE_URL_DISPLAY_MAX_CHARS - 1)}…`
  }
}

/** 库内/标签标题：压空白后截断。 */
export function formatClueUrlResolvedTitle(title: string): string {
  const cleaned = title.replace(/\s+/g, ' ').trim()
  if (!cleaned) {
    return ''
  }
  if (cleaned.length <= CLUE_URL_DISPLAY_MAX_CHARS) {
    return cleaned
  }
  return `${cleaned.slice(0, CLUE_URL_DISPLAY_MAX_CHARS - 1)}…`
}

/** 有解析标题用标题，否则缩短 host/path。 */
export function resolveClueUrlChipLabel(href: string, resolvedTitle?: string | null): string {
  const titled = resolvedTitle ? formatClueUrlResolvedTitle(resolvedTitle) : ''
  return titled || formatClueUrlDisplayLabel(href)
}
