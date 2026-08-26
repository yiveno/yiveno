import type { TranslateFn } from '@/core/i18n/translate'
import { RECALL_RESULT_PAGE_SIZE } from '@/core/recall/build-recall-result'
import { getRecallMatchFieldShortLabel } from '@/core/recall/explain-recall-match'
import { getMemoryItemOpenHref, getOmniboxSuggestContent } from '@/core/recall/memory-open-href'
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

/** 生成 Omnibox 建议时需要的扩展详情页地址与翻译。 */
export interface OmniboxSuggestOptions {
  detailPageUrl: string
  translate: TranslateFn
}

/** Omnibox 摘录预览最大字符数。 */
const EXCERPT_PREVIEW_MAX = 40

/** 转义 Omnibox description 中的 XML 预定义实体。 */
export function escapeOmniboxXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** 压缩空白并截断，供 Omnibox 单行展示。 */
export function truncateOmniboxText(text: string, maxLength: number): string {
  const compact = text.replace(/\s+/g, ' ').trim()
  if (compact.length <= maxLength) {
    return compact
  }
  return `${compact.slice(0, Math.max(1, maxLength - 1))}…`
}

/** Omnibox 类型前缀：与 Chrome 历史建议区分，并标识 Memory 类型。 */
export function getOmniboxTypePrefix(
  itemType: RecallMatch['item']['type'],
  translate: TranslateFn
): string {
  return itemType === 'bookmark'
    ? translate('omnibox_type_bookmark')
    : translate('omnibox_type_excerpt')
}

/** 取首个命中字段的短标签。 */
export function formatOmniboxPrimaryMatch(
  matchedFields: string[],
  translate: TranslateFn
): string | null {
  const primary = matchedFields[0]
  if (!primary) {
    return null
  }
  return getRecallMatchFieldShortLabel(primary, translate)
}

/**
 * 将单条命中转为 Omnibox 建议。
 * content：摘录为 detail.html?id=；书签为 omnibox-open.html?id=（便于写回打开）。
 */
export function recallMatchToOmniboxSuggest(
  match: RecallMatch,
  options: OmniboxSuggestOptions
): OmniboxSuggestItem | null {
  const { translate } = options
  const display = getMemoryItemDisplay(match.item, translate)
  const openHref = getMemoryItemOpenHref(match.item, options).trim()
  if (!openHref) {
    return null
  }
  if (match.item.type === 'bookmark' && !tryParseHttpUrl(openHref)) {
    return null
  }

  const content = getOmniboxSuggestContent(match.item, options).trim()
  if (!content) {
    return null
  }

  const typePrefix = escapeOmniboxXml(getOmniboxTypePrefix(match.item.type, translate))
  const primaryText =
    match.item.type === 'text_excerpt'
      ? display.excerpt || display.subtitle || display.url || openHref
      : display.title || display.subtitle || display.url || openHref
  const primaryMax = match.item.type === 'text_excerpt' ? EXCERPT_PREVIEW_MAX : 48
  const primary = escapeOmniboxXml(truncateOmniboxText(primaryText, primaryMax))
  const provenance = display.subtitle.trim()
    ? escapeOmniboxXml(truncateOmniboxText(display.subtitle, 28))
    : ''

  const parts: string[] = [`<dim>${typePrefix}</dim>`, `<match>${primary}</match>`]

  if (provenance) {
    parts.push('<dim>·</dim>', `<url>${provenance}</url>`)
  }

  if (match.item.type !== 'text_excerpt') {
    const primaryMatch = formatOmniboxPrimaryMatch(match.matchedFields, translate)
    if (primaryMatch) {
      parts.push(`<dim>· ${escapeOmniboxXml(primaryMatch)}</dim>`)
    }
  }

  const duplicateCount = match.duplicateGroup?.totalCount
  if (duplicateCount !== undefined && duplicateCount >= 2) {
    parts.push(
      `<dim>· ${escapeOmniboxXml(translate('omnibox_duplicate_count', String(duplicateCount)))}</dim>`
    )
  }

  return {
    content,
    description: parts.join(' ')
  }
}

/**
 * 将 Recall 结果映射为 Omnibox 建议列表。
 * 仅首屏 PAGE_SIZE（避免宽线索把 omnibox 刷满）；content 须与用户输入不同才会显示。
 */
export function recallResultToOmniboxSuggests(
  result: RecallResult,
  options: OmniboxSuggestOptions
): OmniboxSuggestItem[] {
  const matches: RecallMatch[] = []
  if (result.topPick) {
    matches.push(result.topPick)
  }
  matches.push(...result.alsoPossible)

  const seenContents = new Set<string>()
  const suggests: OmniboxSuggestItem[] = []

  for (const match of matches.slice(0, RECALL_RESULT_PAGE_SIZE)) {
    const suggest = recallMatchToOmniboxSuggest(match, options)
    if (!suggest || seenContents.has(suggest.content)) {
      continue
    }
    seenContents.add(suggest.content)
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
