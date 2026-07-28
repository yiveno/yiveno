import type { TranslateFn } from '@/core/i18n/translate'
import type { MemoryItem } from '@/core/memory/memory-item'
import { explainRecallMatch, getRecallMatchFieldLabel } from '@/core/recall/explain-recall-match'

/** 单次召回命中项。 */
export interface RecallMatch {
  item: MemoryItem
  score: number
  matchedFields: string[]
  /** 同键折叠组；仅 totalCount≥2 时出现。 */
  duplicateGroup?: RecallDuplicateGroup
}

/** Recall 结果中同键重复组（代表项外挂）。 */
export interface RecallDuplicateGroup {
  /** 含代表，≥2。 */
  totalCount: number
  /** 组内除代表外的成员（已按代表规则排序）。 */
  siblings: RecallMatch[]
}

/** Recall 结果形态。 */
export type RecallOutcome = 'top_pick' | 'need_a_clue' | 'no_match'

/** 关键词 Filter 召回结果。 */
export interface RecallResult {
  outcome: RecallOutcome
  topPick: RecallMatch | null
  alsoPossible: RecallMatch[]
  clue: string
}

/** UI 展示用的 MemoryItem 摘要。 */
export interface MemoryItemDisplay {
  /**
   * 主标题。
   * 书签：书签名。摘录：空字符串（无标题；正文见 excerpt）。
   */
  title: string
  /**
   * 副信息。
   * 书签：域名。摘录：出处（页名 · 域名），不是标题。
   */
  subtitle: string
  url: string
  /** 摘录正文（主内容）；书签无。 */
  excerpt?: string
  /** 用户自拟备注；无则省略。 */
  note?: string
  typeLabel: string
}

/** 摘录出处行：页名 · 域名；无页名则仅域名。 */
export function formatExcerptProvenance(pageTitle: string, domain: string): string {
  const page = pageTitle.trim()
  const host = domain.trim()
  if (page && host && page !== host) {
    return `${page} · ${host}`
  }
  return page || host
}

/** 提取 MemoryItem 的展示字段（纯函数）。 */
export function getMemoryItemDisplay(item: MemoryItem, translate: TranslateFn): MemoryItemDisplay {
  if (item.type === 'bookmark') {
    return {
      title: item.payload.title,
      subtitle: item.payload.domain,
      url: item.payload.url,
      ...(item.clues.note?.trim() ? { note: item.clues.note.trim() } : {}),
      typeLabel: translate('type_label_bookmark')
    }
  }

  return {
    title: '',
    subtitle: formatExcerptProvenance(item.payload.pageTitle, item.payload.domain),
    url: item.payload.sourceUrl,
    excerpt: item.payload.selectedText,
    ...(item.clues.note?.trim() ? { note: item.clues.note.trim() } : {}),
    typeLabel: translate('type_label_excerpt')
  }
}

/**
 * 生成命中解释文案（兼容旧调用）。
 * 仅有字段列表、无线索时退化为字段名列表。
 */
export function formatMatchedFields(
  matchedFields: string[],
  translate: TranslateFn,
  clue = ''
): string {
  if (!clue.trim()) {
    const unique = [
      ...new Set(matchedFields.map(field => getRecallMatchFieldLabel(field, translate)))
    ]
    if (unique.length === 0) {
      return translate('explain_content_related')
    }
    return translate('explain_matched_prefix', unique.join(translate('explain_list_separator')))
  }

  return explainRecallMatch({ clue, matchedFields }, translate).reasonLine
}
