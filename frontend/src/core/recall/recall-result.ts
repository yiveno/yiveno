import type { MemoryItem } from '@/core/memory/memory-item'

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

/** 生成命中解释文案。 */
export function formatMatchedFields(matchedFields: string[]): string {
  const labels: Record<string, string> = {
    title: '标题',
    textExcerpt: '正文片段',
    summary: '摘要',
    domain: '域名',
    url: '链接',
    keywords: '关键词',
    tags: '标签',
    note: '备注'
  }

  const unique = [...new Set(matchedFields.map(field => labels[field] ?? field))]
  if (unique.length === 0) {
    return '内容相关'
  }
  return `匹配：${unique.join('、')}`
}
