import type { MemoryItem } from '@/core/memory/memory-item'
import type { RecallMatch } from '@/core/recall/recall-result'

/** 纳入候选的最低分数。 */
export const RECALL_MIN_MATCH_SCORE = 10

/** Top Pick 最低分数。 */
export const RECALL_TOP_PICK_MIN_SCORE = 18

const FIELD_WEIGHTS: Record<string, number> = {
  title: 24,
  textExcerpt: 18,
  summary: 16,
  domain: 14,
  url: 10,
  keywords: 12,
  tags: 12,
  note: 10
}

interface SearchableField {
  field: string
  text: string
}

/** 归一化筛选文本。 */
export function normalizeRecallText(text: string): string {
  return text.trim().toLowerCase()
}

/** 将线索拆分为 token；保留整句以便中文短语匹配。 */
export function tokenizeRecallClue(clue: string): string[] {
  const normalized = normalizeRecallText(clue)
  if (!normalized) {
    return []
  }

  const splitTokens = normalized
    .split(/[\s,，、；;|/]+/)
    .map(token => token.trim())
    .filter(token => token.length > 0)

  const tokens = new Set<string>()
  if (normalized.length >= 2) {
    tokens.add(normalized)
  }
  for (const token of splitTokens) {
    tokens.add(token)
  }

  return [...tokens]
}

/** 收集 MemoryItem 的可检索字段。 */
export function collectSearchableFields(item: MemoryItem): SearchableField[] {
  const fields: SearchableField[] = []
  const { clues } = item

  if (clues.title) {
    fields.push({ field: 'title', text: clues.title })
  }
  if (clues.textExcerpt) {
    fields.push({ field: 'textExcerpt', text: clues.textExcerpt })
  }
  if (clues.summary) {
    fields.push({ field: 'summary', text: clues.summary })
  }
  if (clues.domain) {
    fields.push({ field: 'domain', text: clues.domain })
  }
  if (clues.sourceUrl) {
    fields.push({ field: 'url', text: clues.sourceUrl })
  }
  if (clues.note) {
    fields.push({ field: 'note', text: clues.note })
  }
  if (clues.keywords.length > 0) {
    fields.push({ field: 'keywords', text: clues.keywords.join(' ') })
  }
  if (clues.tags.length > 0) {
    fields.push({ field: 'tags', text: clues.tags.join(' ') })
  }

  if (item.type === 'bookmark') {
    fields.push({ field: 'title', text: item.payload.title })
    fields.push({ field: 'url', text: item.payload.url })
    fields.push({ field: 'domain', text: item.payload.domain })
  } else {
    fields.push({ field: 'title', text: item.payload.pageTitle })
    fields.push({ field: 'textExcerpt', text: item.payload.selectedText })
    fields.push({ field: 'url', text: item.payload.sourceUrl })
    fields.push({ field: 'domain', text: item.payload.domain })
    if (item.payload.contextBefore) {
      fields.push({ field: 'textExcerpt', text: item.payload.contextBefore })
    }
    if (item.payload.contextAfter) {
      fields.push({ field: 'textExcerpt', text: item.payload.contextAfter })
    }
  }

  return fields
}

/** 对单个 MemoryItem 计算关键词分数。 */
export function scoreMemoryItem(item: MemoryItem, clue: string): RecallMatch {
  const tokens = tokenizeRecallClue(clue)
  const matchedFields = new Set<string>()
  let score = 0

  if (tokens.length === 0) {
    return { item, score: 0, matchedFields: [] }
  }

  for (const { field, text } of collectSearchableFields(item)) {
    const normalizedText = normalizeRecallText(text)
    if (!normalizedText) {
      continue
    }

    const weight = FIELD_WEIGHTS[field] ?? 8

    for (const token of tokens) {
      if (!normalizedText.includes(token)) {
        continue
      }

      matchedFields.add(field)
      score += weight

      if (token.length >= 4 && normalizedText === token) {
        score += weight
      }
    }
  }

  return {
    item,
    score,
    matchedFields: [...matchedFields]
  }
}

/** 对 MemoryItem 列表执行关键词 Filter 并排序。 */
export function filterMemoryItemsByKeyword(
  items: MemoryItem[],
  clue: string,
  options: { limit?: number; minScore?: number } = {}
): RecallMatch[] {
  const limit = options.limit ?? 6
  const minScore = options.minScore ?? RECALL_MIN_MATCH_SCORE

  return items
    .map(item => scoreMemoryItem(item, clue))
    .filter(match => match.score >= minScore)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }
      return right.item.updatedAt.localeCompare(left.item.updatedAt)
    })
    .slice(0, limit)
}
