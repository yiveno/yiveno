/**
 * 召回命中解释：根据线索 token 与匹配字段生成可读原因。
 * 纯函数，无 Chrome / DOM 依赖。
 */
import {
  collectSearchableFields,
  normalizeRecallText,
  tokenizeRecallClue
} from '@/core/recall/keyword-filter'
import type { MemoryItem } from '@/core/memory/memory-item'

/** Popup / 长文案用字段标签。 */
export const RECALL_MATCH_FIELD_LABELS: Record<string, string> = {
  title: '标题',
  textExcerpt: '正文片段',
  summary: '摘要',
  domain: '域名',
  url: '链接',
  keywords: '关键词',
  tags: '标签',
  note: '备注'
}

/** Omnibox 等窄空间短标签。 */
export const RECALL_MATCH_FIELD_SHORT_LABELS: Record<string, string> = {
  title: '标题',
  textExcerpt: '正文',
  summary: '摘要',
  domain: '域名',
  url: '链接',
  keywords: '关键词',
  tags: '标签',
  note: '备注'
}

/** 与 keyword-filter 一致的字段权重，用于选择主因字段。 */
const FIELD_PRIORITY: Record<string, number> = {
  title: 24,
  textExcerpt: 18,
  summary: 16,
  domain: 14,
  url: 10,
  keywords: 12,
  tags: 12,
  note: 10
}

const TOKEN_QUOTE_MAX = 12
const CLUE_ECHO_MAX = 24

export interface RecallMatchExplanation {
  /** 主因，如「因标题含「留存」」。 */
  primary: string
  /** 次要字段说明，如「还匹配：域名」；无则为 null。 */
  secondary: string | null
  /** 卡片灰字单行（主因；有次要时拼接）。 */
  reasonLine: string
}

/** 字段键 → 中文标签（长）。 */
export function getRecallMatchFieldLabel(field: string): string {
  return RECALL_MATCH_FIELD_LABELS[field] ?? field
}

/** 字段键 → 中文短标签。 */
export function getRecallMatchFieldShortLabel(field: string): string {
  return RECALL_MATCH_FIELD_SHORT_LABELS[field] ?? field
}

/** 按权重选主因字段（matchedFields 顺序为辅）。 */
export function pickPrimaryMatchedField(matchedFields: string[]): string | null {
  if (matchedFields.length === 0) {
    return null
  }

  let best = matchedFields[0]!
  let bestWeight = FIELD_PRIORITY[best] ?? 0

  for (const field of matchedFields) {
    const weight = FIELD_PRIORITY[field] ?? 0
    if (weight > bestWeight) {
      best = field
      bestWeight = weight
    }
  }

  return best
}

/** 截断展示用文本。 */
export function truncateRecallExplainText(text: string, maxLength: number): string {
  const compact = text.replace(/\s+/g, ' ').trim()
  if (compact.length <= maxLength) {
    return compact
  }
  return `${compact.slice(0, Math.max(1, maxLength - 1))}…`
}

/**
 * 在主因字段的可检索文本中，找线索里命中的 token（优先更长）。
 * 无 item 或找不到时回退到线索首个 token / 整句截断。
 */
export function findMatchedClueToken(input: {
  clue: string
  primaryField: string
  item?: MemoryItem
}): string | null {
  const tokens = tokenizeRecallClue(input.clue)
  if (tokens.length === 0) {
    return null
  }

  const sortedTokens = [...tokens].sort((a, b) => b.length - a.length)

  if (input.item) {
    const fieldTexts = collectSearchableFields(input.item)
      .filter(entry => entry.field === input.primaryField)
      .map(entry => normalizeRecallText(entry.text))
      .filter(text => text.length > 0)

    for (const token of sortedTokens) {
      if (fieldTexts.some(text => text.includes(token))) {
        return token
      }
    }
  }

  return sortedTokens[0] ?? null
}

/** 生成命中解释。 */
export function explainRecallMatch(input: {
  clue: string
  matchedFields: string[]
  item?: MemoryItem
}): RecallMatchExplanation {
  const uniqueFields = [...new Set(input.matchedFields)]
  const primaryField = pickPrimaryMatchedField(uniqueFields)

  if (!primaryField) {
    return {
      primary: '内容相关',
      secondary: null,
      reasonLine: '内容相关'
    }
  }

  const fieldLabel = getRecallMatchFieldLabel(primaryField)
  const token = findMatchedClueToken({
    clue: input.clue,
    primaryField,
    ...optionalItem(input.item)
  })

  const primary = token
    ? `因${fieldLabel}含「${truncateRecallExplainText(token, TOKEN_QUOTE_MAX)}」`
    : `因${fieldLabel}相关`

  const secondaryFields = uniqueFields.filter(field => field !== primaryField)
  const secondary =
    secondaryFields.length > 0
      ? `还匹配：${secondaryFields.map(getRecallMatchFieldLabel).join('、')}`
      : null

  return {
    primary,
    secondary,
    reasonLine: secondary ? `${primary}；${secondary}` : primary
  }
}

/** 结果卡线索回显。 */
export function formatRecallClueEcho(clue: string): string {
  const trimmed = clue.trim()
  if (!trimmed) {
    return ''
  }
  return `根据线索「${truncateRecallExplainText(trimmed, CLUE_ECHO_MAX)}」`
}

/**
 * 有库无命中时的「缩短后再试」线索。
 * 优先取首个空白前片段；否则取前 8 字；若已无法再缩短则返回 null。
 */
export function shortenClueForRetry(clue: string): string | null {
  const trimmed = clue.trim()
  if (!trimmed) {
    return null
  }

  const firstToken = trimmed.split(/[\s,，、；;|/]+/).find(part => part.length > 0)
  if (firstToken && firstToken.length < trimmed.length) {
    return firstToken
  }

  if (trimmed.length > 8) {
    return trimmed.slice(0, 8)
  }

  return null
}

function optionalItem(item: MemoryItem | undefined): { item: MemoryItem } | Record<string, never> {
  return item ? { item } : {}
}
