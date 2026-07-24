import {
  getMemoryItemDisplay,
  type RecallMatch,
  type RecallResult
} from '@/core/recall/recall-result'

/** Omnibox SuggestResult 的纯数据形态（无 Chrome 依赖）。 */
export interface OmniboxSuggestItem {
  content: string
  description: string
}

/** Omnibox 摘录预览最大字符数。 */
const EXCERPT_PREVIEW_MAX = 40

const MATCH_FIELD_SHORT_LABELS: Record<string, string> = {
  title: '标题',
  textExcerpt: '正文',
  summary: '摘要',
  domain: '域名',
  url: '链接',
  keywords: '关键词',
  tags: '标签',
  note: '备注'
}

/** 转义 Omnibox description 中的 XML 预定义实体。 */
export function escapeOmniboxXml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

/** 压缩空白并截断，供 Omnibox 单行展示。 */
export function truncateOmniboxText(text: string, maxLength: number): string {
  const compact = text.replace(/\s+/g, ' ').trim()
  if (compact.length <= maxLength) {
    return compact
  }
  return `${compact.slice(0, Math.max(1, maxLength - 1))}…`
}

/** Omnibox 类型前缀：与 Chrome 历史/搜索建议区分，并标识 Memory 类型。 */
export function getOmniboxTypePrefix(itemType: RecallMatch['item']['type']): string {
  return itemType === 'bookmark' ? 'Y·书签' : 'Y·摘录'
}

/** 取首个命中字段的短标签（避免「匹配：标题、域名、链接」长串）。 */
export function formatOmniboxPrimaryMatch(matchedFields: string[]): string | null {
  const primary = matchedFields[0]
  if (!primary) {
    return null
  }
  return MATCH_FIELD_SHORT_LABELS[primary] ?? primary
}

/**
 * 将单条命中转为 Omnibox 建议。
 * 格式：Y·书签|摘录  标题  ·  域名  〔摘录预览或命中字段〕
 */
export function recallMatchToOmniboxSuggest(match: RecallMatch): OmniboxSuggestItem | null {
  const display = getMemoryItemDisplay(match.item)
  const url = display.url.trim()
  if (!url) {
    return null
  }

  const typePrefix = escapeOmniboxXml(getOmniboxTypePrefix(match.item.type))
  const title = escapeOmniboxXml(truncateOmniboxText(display.title || display.subtitle || url, 48))
  const domain = display.subtitle.trim()
    ? escapeOmniboxXml(truncateOmniboxText(display.subtitle, 28))
    : ''

  const parts: string[] = [`<dim>${typePrefix}</dim>`, `<match>${title}</match>`]

  if (domain) {
    parts.push('<dim>·</dim>', `<url>${domain}</url>`)
  }

  if (match.item.type === 'text_excerpt' && display.excerpt?.trim()) {
    const quote = escapeOmniboxXml(truncateOmniboxText(display.excerpt, EXCERPT_PREVIEW_MAX))
    parts.push(`<dim>「${quote}」</dim>`)
  } else {
    const primaryMatch = formatOmniboxPrimaryMatch(match.matchedFields)
    if (primaryMatch) {
      parts.push(`<dim>· ${escapeOmniboxXml(primaryMatch)}</dim>`)
    }
  }

  return {
    content: url,
    description: parts.join(' ')
  }
}

/**
 * 将 Recall 结果映射为 Omnibox 建议列表。
 * Top Pick + Also Possible；content 必须与用户输入不同才会显示。
 */
export function recallResultToOmniboxSuggests(result: RecallResult): OmniboxSuggestItem[] {
  const matches: RecallMatch[] = []
  if (result.topPick) {
    matches.push(result.topPick)
  }
  matches.push(...result.alsoPossible)

  const seenUrls = new Set<string>()
  const suggests: OmniboxSuggestItem[] = []

  for (const match of matches) {
    const suggest = recallMatchToOmniboxSuggest(match)
    if (!suggest || seenUrls.has(suggest.content)) {
      continue
    }
    seenUrls.add(suggest.content)
    suggests.push(suggest)
  }

  return suggests
}

/** 若文本为 http(s) URL 则返回规范化 href，否则 null。 */
export function tryParseHttpUrl(text: string): string | null {
  try {
    const url = new URL(text.trim())
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return url.href
    }
  } catch {
    return null
  }
  return null
}
