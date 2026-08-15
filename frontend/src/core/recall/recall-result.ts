import type { TranslateFn } from '@/core/i18n/translate'
import type { MemoryItem } from '@/core/memory/memory-item'
import { explainRecallMatch, getRecallMatchFieldLabel } from '@/core/recall/explain-recall-match'
import type { ParsedRecallClue } from '@/core/recall/parse-recall-clue-types'

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

/**
 * Recall 结果形态。
 * - top_pick：高置信头名作**建议**（须配邻域，非神谕唯一答案）
 * - need_a_clue：弱命中，需追问/补线索
 * - no_match：无可用命中
 */
export type RecallOutcome =
  | 'top_pick' // 高置信建议（Top Pick）
  | 'need_a_clue' // 弱命中，需补线索
  | 'no_match' // 无命中

/**
 * no_match 细分（产品文档 §7.0）。
 * - constrained_none：时间+类型等强约束下库内无痕迹（事实空）
 * - unconstrained：约束不足或无法判定约束空
 */
export type RecallEmptyKind =
  | 'constrained_none' // 强约束下库空
  | 'unconstrained' // 模糊空 / 仍需线索

/** 关键词 Filter 召回结果。 */
export interface RecallResult {
  outcome: RecallOutcome
  topPick: RecallMatch | null
  alsoPossible: RecallMatch[]
  /** 本轮用户输入（对话气泡展示）。 */
  clue: string
  /** 合并后（或单轮）解析结果；供追问模板；噪音拒绝时可能缺省。 */
  parsed?: ParsedRecallClue
  /** 合并后的有效原文（高亮 / 调试）；单轮时约等于 clue。 */
  effectiveClue?: string
  /** 仅 outcome=no_match 时有意义。 */
  emptyKind?: RecallEmptyKind
  /**
   * 疑似记错时的最近同类真实条目；非 Top Pick。
   * 仅 emptyKind=constrained_none 且库内确有同类时出现。
   */
  relatedGuess?: RecallMatch | null
  /**
   * LLM 追问 NLG（已门禁）；缺省时 UI 降级规则模板。
   * source 恒为 llm（规则路径不写本字段）。
   */
  assistantFollowUp?: {
    source: 'llm' // 模型生成（经 Zod/门禁）
    text: string
    suggestions: Array<{
      id: string
      label: string
      value: string
    }>
  }
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
