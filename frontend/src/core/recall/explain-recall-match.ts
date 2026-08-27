/**
 * 召回命中解释：根据线索 token 与匹配字段生成可读原因。
 * 纯函数；文案经注入的 translate，无 Chrome / DOM 依赖。
 */
import type { TranslateFn } from '@/core/i18n/translate'
import {
  collectSearchableFields,
  normalizeRecallText,
  tokenizeRecallClue
} from '@/core/recall/keyword-filter'
import type { MemoryItem } from '@/core/memory/memory-item'

const FIELD_LABEL_KEYS: Record<string, string> = {
  title: 'explain_field_title',
  textExcerpt: 'explain_field_text_excerpt',
  excerptContext: 'explain_field_excerpt_context',
  pageTitle: 'explain_field_page_title',
  summary: 'explain_field_summary',
  domain: 'explain_field_domain',
  url: 'explain_field_url',
  keywords: 'explain_field_keywords',
  tags: 'explain_field_tags',
  note: 'explain_field_note',
  embedding: 'explain_field_embedding',
  hybridRrf: 'explain_field_hybrid_rrf',
  constraint_neighborhood: 'explain_field_constraint_neighborhood'
}

const FIELD_SHORT_LABEL_KEYS: Record<string, string> = {
  title: 'explain_field_short_title',
  textExcerpt: 'explain_field_short_text_excerpt',
  excerptContext: 'explain_field_short_excerpt_context',
  pageTitle: 'explain_field_short_page_title',
  summary: 'explain_field_short_summary',
  domain: 'explain_field_short_domain',
  url: 'explain_field_short_url',
  keywords: 'explain_field_short_keywords',
  tags: 'explain_field_short_tags',
  note: 'explain_field_short_note',
  embedding: 'explain_field_short_embedding',
  hybridRrf: 'explain_field_short_hybrid_rrf',
  constraint_neighborhood: 'explain_field_short_constraint_neighborhood'
}

/** 与 keyword-filter 一致的字段权重，用于选择主因字段。 */
const FIELD_PRIORITY: Record<string, number> = {
  title: 24,
  textExcerpt: 18,
  excerptContext: 8,
  pageTitle: 20,
  summary: 16,
  domain: 14,
  url: 10,
  keywords: 12,
  tags: 12,
  note: 26,
  /** 语义近邻：弱于主文词面，但仍可作唯一主因。 */
  embedding: 15,
  /** 约束邻域（仅类型/时间/刚存）：专用解释，不作「正文含 token」。 */
  constraint_neighborhood: 22,
  /** RRF 标记字段：解释时不作主因。 */
  hybridRrf: 0
}

const TOKEN_QUOTE_MAX = 12
const CLUE_ECHO_MAX = 24

export interface RecallMatchExplanation {
  /** 主因。 */
  primary: string
  /** 次要字段说明；无则为 null。 */
  secondary: string | null
  /** 卡片灰字单行（主因；有次要时拼接）。 */
  reasonLine: string
}

/** 字段键 → 本地化长标签。 */
export function getRecallMatchFieldLabel(field: string, translate: TranslateFn): string {
  const key = FIELD_LABEL_KEYS[field]
  return key ? translate(key) : field
}

/** 字段键 → 本地化短标签。 */
export function getRecallMatchFieldShortLabel(field: string, translate: TranslateFn): string {
  const key = FIELD_SHORT_LABEL_KEYS[field]
  return key ? translate(key) : field
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
export function explainRecallMatch(
  input: {
    clue: string
    matchedFields: string[]
    item?: MemoryItem
  },
  translate: TranslateFn
): RecallMatchExplanation {
  const uniqueFields = [...new Set(input.matchedFields)]
  const primaryField = pickPrimaryMatchedField(uniqueFields)

  if (!primaryField) {
    const related = translate('explain_content_related')
    return {
      primary: related,
      secondary: null,
      reasonLine: related
    }
  }

  // 约束邻域：类型/时间邻域，禁止写成「字段含 clue token」误导
  const primary =
    primaryField === 'constraint_neighborhood'
      ? translate('explain_reason_constraint_neighborhood')
      : (() => {
          const fieldLabel = getRecallMatchFieldLabel(primaryField, translate)
          const token = findMatchedClueToken({
            clue: input.clue,
            primaryField,
            ...optionalItem(input.item)
          })
          return token
            ? translate('explain_reason_field_contains', [
                fieldLabel,
                truncateRecallExplainText(token, TOKEN_QUOTE_MAX)
              ])
            : translate('explain_reason_field_related', fieldLabel)
        })()

  const secondaryFields = uniqueFields.filter(field => field !== primaryField)
  const secondary =
    secondaryFields.length > 0
      ? translate(
          'explain_secondary_also',
          secondaryFields
            .map(field => getRecallMatchFieldLabel(field, translate))
            .join(translate('explain_list_separator'))
        )
      : null

  return {
    primary,
    secondary,
    reasonLine: secondary ? `${primary}${translate('explain_reason_joiner')}${secondary}` : primary
  }
}

/** 结果卡线索回显。 */
export function formatRecallClueEcho(clue: string, translate: TranslateFn): string {
  const trimmed = clue.trim()
  if (!trimmed) {
    return ''
  }
  return translate('explain_clue_echo', truncateRecallExplainText(trimmed, CLUE_ECHO_MAX))
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
