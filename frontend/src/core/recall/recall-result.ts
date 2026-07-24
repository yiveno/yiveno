import type { MemoryItem } from '@/core/memory/memory-item'
import { explainRecallMatch, getRecallMatchFieldLabel } from '@/core/recall/explain-recall-match'

/** 单次召回命中项。 */
export interface RecallMatch {
  item: MemoryItem
  score: number
  matchedFields: string[]
}

/** Recall 结果形态。 */
export type RecallOutcome = 'top_pick' | 'no_match'

/** 关键词 Filter 召回结果。 */
export interface RecallResult {
  outcome: RecallOutcome
  topPick: RecallMatch | null
  alsoPossible: RecallMatch[]
  clue: string
}

/** UI 展示用的 MemoryItem 摘要。 */
export interface MemoryItemDisplay {
  title: string
  subtitle: string
  url: string
  excerpt?: string
  typeLabel: string
}

/** 提取 MemoryItem 的展示字段（纯函数）。 */
export function getMemoryItemDisplay(item: MemoryItem): MemoryItemDisplay {
  if (item.type === 'bookmark') {
    return {
      title: item.payload.title,
      subtitle: item.payload.domain,
      url: item.payload.url,
      typeLabel: '书签'
    }
  }

  return {
    title: item.payload.pageTitle,
    subtitle: item.payload.domain,
    url: item.payload.sourceUrl,
    excerpt: item.payload.selectedText,
    typeLabel: '文字片段'
  }
}

/**
 * 生成命中解释文案（兼容旧调用）。
 * 仅有字段列表、无线索时退化为字段名列表。
 */
export function formatMatchedFields(matchedFields: string[], clue = ''): string {
  if (!clue.trim()) {
    const unique = [...new Set(matchedFields.map(field => getRecallMatchFieldLabel(field)))]
    if (unique.length === 0) {
      return '内容相关'
    }
    return `匹配：${unique.join('、')}`
  }

  return explainRecallMatch({ clue, matchedFields }).reasonLine
}
