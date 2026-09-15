/**
 * Getting Started 摘录口语建议：从真实摘录正文/标题生成 1–3 条口语 clue。
 * 禁止内容别名灰名单；仅固定模板 + 字面片段。
 */

import type { MemoryItem } from '@/core/memory/memory-item'

export interface GettingStartedExcerptSample {
  title: string
  /** 口语样句（en） */
  clue: string
}

/** 固定口语模板（按条轮换）。 */
const ORAL_CLUE_TEMPLATES = [
  (snippet: string) => `That line about ${snippet}`,
  (snippet: string) => `Something I saved that said ${snippet}`,
  (snippet: string) => `The passage where it mentioned ${snippet}`
] as const

const SNIPPET_MAX = 48

/** 从摘录正文压短片段（给口语模板用）。 */
export function formatGettingStartedExcerptSnippet(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, ' ')
  if (!trimmed) {
    return 'something I highlighted'
  }
  if (trimmed.length <= SNIPPET_MAX) {
    return trimmed
  }
  return `${trimmed.slice(0, SNIPPET_MAX - 1).trimEnd()}…`
}

function listEligibleExcerpts(items: readonly MemoryItem[]): MemoryItem[] {
  const excerpts = items.filter(item => {
    if (item.type !== 'text_excerpt') {
      return false
    }
    return item.payload.selectedText.trim().length > 0
  })
  return [...excerpts].sort((a, b) => {
    const aTime = Date.parse(a.updatedAt)
    const bTime = Date.parse(b.updatedAt)
    const aOk = Number.isFinite(aTime)
    const bOk = Number.isFinite(bTime)
    if (aOk && bOk) {
      return bTime - aTime
    }
    if (aOk) {
      return -1
    }
    if (bOk) {
      return 1
    }
    return 0
  })
}

/**
 * 抽最多 `limit` 条不同摘录 → 口语建议（近者优先，模板轮换）。
 */
export function listGettingStartedExcerptSuggestions(
  items: readonly MemoryItem[],
  limit = 3
): GettingStartedExcerptSample[] {
  const max = Math.max(0, Math.min(limit, ORAL_CLUE_TEMPLATES.length))
  const sorted = listEligibleExcerpts(items)
  const out: GettingStartedExcerptSample[] = []
  const seen = new Set<string>()
  for (const item of sorted) {
    if (item.type !== 'text_excerpt' || out.length >= max) {
      break
    }
    const snippet = formatGettingStartedExcerptSnippet(item.payload.selectedText)
    const key = snippet.toLowerCase()
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    const template = ORAL_CLUE_TEMPLATES[out.length]
    if (!template) {
      break
    }
    const title = item.payload.pageTitle.trim() || snippet
    out.push({
      title,
      clue: template(snippet)
    })
  }
  return out
}

/** 解析展示 clue：有样句用样句，否则单条 fallback。 */
export function resolveGettingStartedExcerptSuggestions(
  items: readonly MemoryItem[],
  fallbackClue: string
): GettingStartedExcerptSample[] {
  const samples = listGettingStartedExcerptSuggestions(items, 3)
  if (samples.length > 0) {
    return samples
  }
  const fallback = fallbackClue.trim() || 'something I highlighted'
  return [{ title: '', clue: fallback }]
}
