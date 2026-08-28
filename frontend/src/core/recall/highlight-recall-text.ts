import { findMatchedClueToken, pickPrimaryMatchedField } from '@/core/recall/explain-recall-match'
import type { MemoryItem } from '@/core/memory/memory-item'

/** 高亮片段：hit 为命中子串。 */
export interface RecallHighlightPart {
  text: string
  hit: boolean
}

/** 卡片上可高亮的展示面。 */
/** 高亮作用的展示面。 */
export type RecallHighlightSurface =
  | 'title' // 标题
  | 'excerpt' // 摘录正文
  | 'subtitle' // 副信息 / 出处
  | 'note' // 用户附注（clues.note）

/**
 * 主因字段 → 卡片展示面（与 Side Panel 展示结构对齐）。
 * excerptContext 等无直接展示面时返回 null（仍保留文案解释）。
 */
export function resolveRecallHighlightSurface(
  primaryField: string | null,
  itemType: MemoryItem['type']
): RecallHighlightSurface | null {
  if (!primaryField) {
    return null
  }

  switch (primaryField) {
    case 'title':
      return itemType === 'bookmark' ? 'title' : null
    case 'textExcerpt':
      return itemType === 'text_excerpt' ? 'excerpt' : null
    case 'note':
      return 'note'
    case 'pageTitle':
    case 'domain':
    case 'url':
      return 'subtitle'
    default:
      return null
  }
}

/**
 * 按 needle 拆分原文（大小写不敏感；保留原文大小写）。
 * 语言无关：纯子串，无语种词表。
 */
export function splitTextByHighlight(
  text: string,
  needle: string | null | undefined
): RecallHighlightPart[] {
  if (!text) {
    return []
  }
  const trimmedNeedle = needle?.trim()
  if (!trimmedNeedle) {
    return [{ text, hit: false }]
  }

  const lowerText = text.toLowerCase()
  const lowerNeedle = trimmedNeedle.toLowerCase()
  if (lowerNeedle.length === 0 || !lowerText.includes(lowerNeedle)) {
    return [{ text, hit: false }]
  }

  const parts: RecallHighlightPart[] = []
  let cursor = 0
  let index = lowerText.indexOf(lowerNeedle)

  while (index >= 0) {
    if (index > cursor) {
      parts.push({ text: text.slice(cursor, index), hit: false })
    }
    const end = index + lowerNeedle.length
    parts.push({ text: text.slice(index, end), hit: true })
    cursor = end
    index = lowerText.indexOf(lowerNeedle, cursor)
  }

  if (cursor < text.length) {
    parts.push({ text: text.slice(cursor), hit: false })
  }

  return parts.length > 0 ? parts : [{ text, hit: false }]
}

/** 为结果卡片生成各展示面的高亮分段。 */
export function buildRecallCardHighlightParts(input: {
  clue: string
  matchedFields: string[]
  item: MemoryItem
  title: string
  subtitle: string
  excerpt?: string
  note?: string
}): {
  titleParts: RecallHighlightPart[]
  subtitleParts: RecallHighlightPart[]
  excerptParts: RecallHighlightPart[]
  noteParts: RecallHighlightPart[]
  surface: RecallHighlightSurface | null
} {
  const primaryField = pickPrimaryMatchedField(input.matchedFields)
  const surface = resolveRecallHighlightSurface(primaryField, input.item.type)
  const token =
    primaryField === null
      ? null
      : findMatchedClueToken({
          clue: input.clue,
          primaryField,
          item: input.item
        })

  const plain = (text: string): RecallHighlightPart[] => (text ? [{ text, hit: false }] : [])

  return {
    titleParts: surface === 'title' ? splitTextByHighlight(input.title, token) : plain(input.title),
    subtitleParts:
      surface === 'subtitle' ? splitTextByHighlight(input.subtitle, token) : plain(input.subtitle),
    excerptParts:
      surface === 'excerpt'
        ? splitTextByHighlight(input.excerpt ?? '', token)
        : plain(input.excerpt ?? ''),
    noteParts:
      surface === 'note' ? splitTextByHighlight(input.note ?? '', token) : plain(input.note ?? ''),
    surface
  }
}
