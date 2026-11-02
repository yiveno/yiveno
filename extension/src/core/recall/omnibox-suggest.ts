import type { TranslateFn } from '@/core/i18n/translate'
import { getRecallMatchFieldShortLabel } from '@/core/recall/explain-recall-match'
import { formatRecallSavedTime } from '@/core/recall/format-recall-saved-time'
import { getMemoryItemOpenHref, getOmniboxSuggestContent } from '@/core/recall/memory-open-href'
import {
  getMemoryItemDisplay,
  type RecallMatch,
  type RecallResult
} from '@/core/recall/recall-result'

/**
 * Omnibox 下拉建议条数上限（Normative · 与 Side Panel `RECALL_RESULT_PAGE_SIZE` 解耦）。
 *
 * Omnibox 无 Show more：这一屏是唯一机会。Chrome 官方未钉死扩展 SuggestResult 条数；
 * MDN 常写「前 6 条」、桌面整栏 autocomplete 约 8（含 default 行）。本常量取 6 为自限预算，
 * 禁止复用 Panel 首屏页长。
 *
 * **有 Memory 命中时：** 末行固定「换赛道」CTA（handoff），Memory 行 ≤ {@link OMNIBOX_MEMORY_SUGGEST_LIMIT}。
 */
export const OMNIBOX_SUGGEST_LIMIT = 6

/** 有换赛道 CTA 时 Memory 建议上限（总预算 − 1）。 */
export const OMNIBOX_MEMORY_SUGGEST_LIMIT = OMNIBOX_SUGGEST_LIMIT - 1

/**
 * Omnibox **default 行**（平台强制 C 位）：友情提示，非 CTA、无命中接力。
 * 价值：教用户「快跳要关键字 / 模糊去 Side Panel」——出镜率最高故须一句顶用。
 * 有真实快捷键才括号展示，禁止写死 manifest 建议键。
 */
export function formatOmniboxDefaultSuggestionDescription(
  openRecallShortcut: string | null | undefined,
  translate: TranslateFn
): string {
  const shortcut = openRecallShortcut?.trim() ?? ''
  if (shortcut.length > 0) {
    return translate('omnibox_default_suggestion_with_shortcut', shortcut)
  }
  return translate('omnibox_default_suggestion')
}

/**
 * 无命中时可点 SuggestResult 文案（CTA 行；与 default 友情提示分工）。
 * 规则同 `formatOmniboxDefaultSuggestionDescription`（有真实快捷键才括号展示）。
 */
export function formatOmniboxNoMatchSuggestionDescription(
  openRecallShortcut: string | null | undefined,
  translate: TranslateFn
): string {
  const shortcut = openRecallShortcut?.trim() ?? ''
  if (shortcut.length > 0) {
    return translate('omnibox_no_match_with_shortcut', shortcut)
  }
  return translate('omnibox_no_match')
}

/**
 * 有快跳命中时末行「换赛道」CTA：不满意当前邻域 → Side Panel 完整 Recall。
 * 规则同无命中 CTA（有真实快捷键才括号展示）。
 */
export function formatOmniboxSwitchTrackSuggestionDescription(
  openRecallShortcut: string | null | undefined,
  translate: TranslateFn
): string {
  const shortcut = openRecallShortcut?.trim() ?? ''
  if (shortcut.length > 0) {
    return translate('omnibox_switch_track_with_shortcut', shortcut)
  }
  return translate('omnibox_switch_track')
}

/**
 * 无命中可点建议的 content 前缀（≠ 用户输入，避免被 Chrome 吞掉）。
 * onInputEntered 解析后接力 Side Panel。
 */
export const OMNIBOX_HANDOFF_CONTENT_PREFIX = 'yiveno-omnibox-handoff:' as const

/** 构造无命中接力 content（须与线索字面不同）。 */
export function buildOmniboxHandoffContent(clue: string): string {
  return `${OMNIBOX_HANDOFF_CONTENT_PREFIX}${encodeURIComponent(clue.trim())}`
}

/** 若为无命中接力 content 则返回线索，否则 null。 */
export function tryParseOmniboxHandoffClue(text: string): string | null {
  const raw = text.trim()
  if (!raw.startsWith(OMNIBOX_HANDOFF_CONTENT_PREFIX)) {
    return null
  }
  try {
    const decoded = decodeURIComponent(raw.slice(OMNIBOX_HANDOFF_CONTENT_PREFIX.length)).trim()
    return decoded.length > 0 ? decoded : null
  } catch {
    return null
  }
}

/** Omnibox SuggestResult 的纯数据形态（无 Chrome 依赖）。 */
export interface OmniboxSuggestItem {
  content: string
  description: string
}

/** 生成 Omnibox 建议时需要的扩展详情页地址与翻译。 */
export interface OmniboxSuggestOptions {
  detailPageUrl: string
  translate: TranslateFn
  /** 用户线索（用于命中字段短标签；缺省则省略理由尾缀；换赛道 CTA 必填）。 */
  clue?: string
  /** `_execute_action` 当前绑定；仅用于换赛道 CTA 文案括号。 */
  openRecallShortcut?: string | null
  /**
   * 有 Memory 建议时末行追加换赛道 CTA（默认 true）。
   * 无命中空列表仍由 listener 单独 suggest 无命中 CTA。
   */
  includeSwitchTrackCta?: boolean
  /** BCP 47；相对/绝对保存时间跟 UI locale（缺省 en）。 */
  locale?: string
}

/** Omnibox 主文最大字符（书签标题 / 摘录锚点）。 */
const PRIMARY_MAX = 52

/** Omnibox 域名 / 出处最大字符。 */
const URL_DISPLAY_MAX = 36

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

/** 展示用 host：优先 payload.domain，否则从 URL 解析；去 www。 */
function displayHostForOmnibox(match: RecallMatch, fallbackSubtitle: string): string {
  const fromPayload =
    match.item.type === 'bookmark'
      ? match.item.payload.domain.trim()
      : match.item.payload.domain.trim()
  if (fromPayload) {
    return fromPayload.replace(/^www\./i, '')
  }
  const rawUrl =
    match.item.type === 'bookmark' ? match.item.payload.url : match.item.payload.sourceUrl
  try {
    return new URL(rawUrl).hostname.replace(/^www\./i, '')
  } catch {
    return fallbackSubtitle.trim()
  }
}

/**
 * 将单条命中转为 Omnibox 建议。
 *
 * 布局对齐 Chrome 历史行的可读骨架：`<match>主文</match> — <url>host</url>`，
 * ECS 其余要素收成尾部 dim（类型 · 相对时间 · 命中字段）；禁止长句 Explain。
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

  // 主文：书签=标题；摘录优先页名（可扫如 Chrome），无页名再退正文锚点
  const primaryText =
    match.item.type === 'text_excerpt'
      ? match.item.payload.pageTitle.trim() ||
        display.excerpt?.trim() ||
        display.subtitle ||
        display.url ||
        openHref
      : display.title || display.subtitle || display.url || openHref
  const primary = escapeOmniboxXml(truncateOmniboxText(primaryText, PRIMARY_MAX))
  const host = escapeOmniboxXml(
    truncateOmniboxText(displayHostForOmnibox(match, display.subtitle), URL_DISPLAY_MAX)
  )
  const typePrefix = escapeOmniboxXml(getOmniboxTypePrefix(match.item.type, translate))

  // Chrome 式主轴：标题 — host
  const parts: string[] = [`<match>${primary}</match>`]
  if (host) {
    parts.push('<dim>—</dim>', `<url>${host}</url>`)
  }

  // ECS 尾缀：类型 · 时间 · 短命中字段（布局差异；五要素仍齐）
  const meta: string[] = [typePrefix]

  const savedLabels = formatRecallSavedTime(match.item.createdAt, {
    justSavedLabel: translate('recall_card_saved_just_now'),
    ...(options.locale !== undefined ? { locale: options.locale } : {})
  })
  if (savedLabels) {
    meta.push(escapeOmniboxXml(savedLabels.relative))
  }

  const fieldLabel = formatOmniboxPrimaryMatch(match.matchedFields, translate)
  if (fieldLabel) {
    meta.push(escapeOmniboxXml(fieldLabel))
  }

  const duplicateCount = match.duplicateGroup?.totalCount
  if (duplicateCount !== undefined && duplicateCount >= 2) {
    meta.push(escapeOmniboxXml(translate('omnibox_duplicate_count', String(duplicateCount))))
  }

  if (meta.length > 0) {
    parts.push(`<dim>· ${meta.join(' · ')}</dim>`)
  }

  return {
    content,
    description: parts.join(' ')
  }
}

/**
 * 将 Recall 结果映射为 Omnibox 建议列表。
 * 总条数自限 `OMNIBOX_SUGGEST_LIMIT`（一次性下拉，无分页）。
 * 有命中且开启换赛道时：Memory ≤ {@link OMNIBOX_MEMORY_SUGGEST_LIMIT}，末行 handoff CTA。
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

  const clue = options.clue?.trim() ?? ''
  const appendSwitchTrack = options.includeSwitchTrackCta !== false && clue.length > 0
  const memoryLimit = appendSwitchTrack ? OMNIBOX_MEMORY_SUGGEST_LIMIT : OMNIBOX_SUGGEST_LIMIT

  const seenContents = new Set<string>()
  const suggests: OmniboxSuggestItem[] = []

  for (const match of matches.slice(0, memoryLimit)) {
    const suggest = recallMatchToOmniboxSuggest(match, options)
    if (!suggest || seenContents.has(suggest.content)) {
      continue
    }
    seenContents.add(suggest.content)
    suggests.push(suggest)
    if (suggests.length >= memoryLimit) {
      break
    }
  }

  if (appendSwitchTrack && suggests.length > 0) {
    const handoffContent = buildOmniboxHandoffContent(clue)
    if (!seenContents.has(handoffContent)) {
      suggests.push({
        content: handoffContent,
        description: escapeOmniboxXml(
          formatOmniboxSwitchTrackSuggestionDescription(
            options.openRecallShortcut,
            options.translate
          )
        )
      })
    }
  }

  return suggests.slice(0, OMNIBOX_SUGGEST_LIMIT)
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
