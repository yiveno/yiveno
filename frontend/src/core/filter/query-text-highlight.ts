import { HighlightEngine } from '@/core/query-engine/highlight'

const highlightEngine = new HighlightEngine()

/** 高亮片段（供模板逐段渲染，避免 v-html） */
export interface QueryHighlightSegment {
  text: string
  highlighted: boolean
}

/**
 * 将查询词在文本中拆分为高亮片段
 */
export function highlightQueryTextAsSegments(text: string, query: string): QueryHighlightSegment[] {
  if (!text) {
    return []
  }

  const trimmedQuery = query.trim()
  if (!trimmedQuery) {
    return [{ text, highlighted: false }]
  }

  return highlightEngine.highlight(text, trimmedQuery).map(segment => ({
    text: segment.text,
    highlighted: segment.isMatch
  }))
}

/**
 * 将查询词在文本中高亮为安全 HTML（供 v-html 渲染）
 */
export function highlightQueryTextAsHtml(text: string, query: string): string {
  if (!text) {
    return ''
  }

  const trimmedQuery = query.trim()
  if (!trimmedQuery) {
    return highlightEngine.toHTML([{ text, isMatch: false, start: 0, end: text.length }])
  }

  return highlightEngine.toHTML(highlightEngine.highlight(text, trimmedQuery))
}
