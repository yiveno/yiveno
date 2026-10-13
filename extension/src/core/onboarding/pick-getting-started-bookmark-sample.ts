/**
 * Getting Started 书签口语建议：从真实书签标题生成 1–3 条口语 clue。
 * 禁止内容别名灰名单；仅固定模板 + 标题字面。
 */

export interface GettingStartedBookmarkSampleSource {
  kind: 'folder' | 'bookmark'
  title: string
  /** 保存/创建时刻 ISO；近者优先 */
  savedAt?: string
}

export interface GettingStartedBookmarkSample {
  title: string
  /** 口语样句（en） */
  clue: string
}

/** 固定口语模板（按条轮换；不含内容词典）。 */
const ORAL_CLUE_TEMPLATES = [
  (title: string) => `That article about ${title}`,
  (title: string) => `Something I saved about ${title}`,
  (title: string) => `Something I wanted to read about ${title}`
] as const

/** 单条兜底口语（无标题时）。 */
export function formatGettingStartedBookmarkClue(title: string): string {
  const trimmed = title.trim().replace(/\s+/g, ' ')
  if (!trimmed) {
    return 'something I bookmarked'
  }
  return ORAL_CLUE_TEMPLATES[0](trimmed)
}

function listEligibleBookmarks(
  nodes: readonly GettingStartedBookmarkSampleSource[]
): GettingStartedBookmarkSampleSource[] {
  const bookmarks = nodes.filter(node => {
    if (node.kind !== 'bookmark') {
      return false
    }
    return node.title.trim().length > 0
  })
  return [...bookmarks].sort((a, b) => {
    const aTime = a.savedAt ? Date.parse(a.savedAt) : Number.NaN
    const bTime = b.savedAt ? Date.parse(b.savedAt) : Number.NaN
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
 * 从扁平书签索引挑一条：仅 bookmark、非空 title，savedAt 近者优先。
 */
export function pickGettingStartedBookmarkSample(
  nodes: readonly GettingStartedBookmarkSampleSource[]
): GettingStartedBookmarkSample | null {
  const samples = listGettingStartedBookmarkSuggestions(nodes, 1)
  return samples[0] ?? null
}

/**
 * 抽最多 `limit` 条不同书签标题 → 口语建议（近者优先，模板轮换）。
 */
export function listGettingStartedBookmarkSuggestions(
  nodes: readonly GettingStartedBookmarkSampleSource[],
  limit = 3
): GettingStartedBookmarkSample[] {
  const max = Math.max(0, Math.min(limit, ORAL_CLUE_TEMPLATES.length))
  const sorted = listEligibleBookmarks(nodes)
  const out: GettingStartedBookmarkSample[] = []
  const seenTitles = new Set<string>()
  for (const node of sorted) {
    if (out.length >= max) {
      break
    }
    const title = node.title.trim().replace(/\s+/g, ' ')
    const key = title.toLowerCase()
    if (seenTitles.has(key)) {
      continue
    }
    seenTitles.add(key)
    const template = ORAL_CLUE_TEMPLATES[out.length]
    if (!template) {
      break
    }
    out.push({
      title,
      clue: template(title)
    })
  }
  return out
}

/** 解析最终展示 clue 列表：有样句用样句，否则单条 fallback。 */
export function resolveGettingStartedSampleSuggestions(
  nodes: readonly GettingStartedBookmarkSampleSource[],
  fallbackClue: string
): GettingStartedBookmarkSample[] {
  const samples = listGettingStartedBookmarkSuggestions(nodes, 3)
  if (samples.length > 0) {
    return samples
  }
  const fallback = fallbackClue.trim() || 'something I bookmarked'
  return [{ title: '', clue: fallback }]
}

/** @deprecated 保留给单测兼容；新 UI 用 resolveGettingStartedSampleSuggestions */
export function resolveGettingStartedSampleClue(
  nodes: readonly GettingStartedBookmarkSampleSource[],
  fallbackClue: string
): string {
  return (
    resolveGettingStartedSampleSuggestions(nodes, fallbackClue)[0]?.clue ?? 'something I bookmarked'
  )
}
