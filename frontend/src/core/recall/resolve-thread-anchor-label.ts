/**
 * 本场找回会话标题（thread title）：标识「这场找叫什么」，非过程态文案。
 * 优先首轮用户句；否则用 accumulated contentTerms。供锚点 / status / 日后会话列表复用。
 */

const THREAD_FIND_TITLE_MAX_CHARS = 40

export type ResolveThreadFindTitleInput = {
  priorUserUtterances: readonly string[]
  contentTerms?: readonly string[]
}

/** 截断展示标题（保留可读尾省略）。 */
export function truncateThreadFindTitle(
  raw: string,
  maxChars: number = THREAD_FIND_TITLE_MAX_CHARS
): string {
  const trimmed = raw.trim().replace(/\s+/g, ' ')
  if (trimmed.length <= maxChars) {
    return trimmed
  }
  if (maxChars <= 1) {
    return '…'
  }
  return `${trimmed.slice(0, maxChars - 1).trimEnd()}…`
}

/**
 * 解析本场找回标题；无活动线索时返回 null。
 * P0：字面提炼（首轮句 / contentTerms），禁止 LLM 开放摘要造题。
 */
export function resolveThreadFindTitle(input: ResolveThreadFindTitleInput): string | null {
  const first = input.priorUserUtterances.map(part => part.trim()).find(part => part.length > 0)
  if (first) {
    return truncateThreadFindTitle(first)
  }

  const terms = (input.contentTerms ?? [])
    .map(term => term.trim())
    .filter(Boolean)
    .slice(0, 2)
  if (terms.length === 0) {
    return null
  }
  return truncateThreadFindTitle(terms.join(' '))
}
