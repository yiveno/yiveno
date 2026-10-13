/**
 * 为 MemoryItem 拼 embedding 输入文本（本机 Hybrid / Worker embed）。
 * 截断控制长度，避免烧配额与超模型窗口。
 */

import type { MemoryItem } from '@/core/memory/memory-item'

const MAX_TITLE = 200
const MAX_EXCERPT = 800
const MAX_NOTE = 400
const MAX_KEYWORDS = 200
const MAX_TOTAL = 2000

function clip(value: string | undefined, max: number): string {
  const trimmed = value?.trim() ?? ''
  if (!trimmed) {
    return ''
  }
  return trimmed.length <= max ? trimmed : trimmed.slice(0, max)
}

/**
 * 从 MemoryItem 拼可嵌入文本：标题 / 摘录 / 附注 / keywords。
 */
export function buildEmbeddingTextFromMemoryItem(item: MemoryItem): string {
  const title =
    item.type === 'bookmark'
      ? clip(item.clues.title ?? item.payload.title, MAX_TITLE)
      : clip(item.clues.title ?? item.payload.pageTitle, MAX_TITLE)
  const excerpt =
    item.type === 'text_excerpt'
      ? clip(item.clues.textExcerpt ?? item.payload.selectedText, MAX_EXCERPT)
      : clip(item.clues.textExcerpt ?? item.clues.summary, MAX_EXCERPT)
  const note = clip(item.clues.note, MAX_NOTE)
  const keywords = clip(item.clues.keywords.join(' '), MAX_KEYWORDS)

  const parts = [title, excerpt, note, keywords].filter(Boolean)
  const joined = parts.join('\n').trim()
  if (joined.length <= MAX_TOTAL) {
    return joined
  }
  return joined.slice(0, MAX_TOTAL)
}
