/**
 * 语料锚点质量评估（R2 差距 G3 · R3 检索硬化切片）。
 *
 * 不新增持久化字段：写库仍靠 Zod；召回侧对 weak 降权，避免空壳书签假装可找回。
 * 产品：`docs/engineering/语料适配器契约.md`；类型：`corpus-adapter-contract.ts`。
 */

import type { CorpusQualityGateResult } from '@/core/memory/corpus-adapter-contract'
import type { MemoryItem } from '@/core/memory/memory-item'

/** 弱锚点在关键词打分上的扣减（须低于单字段强命中，避免误杀有标题书签）。 */
export const RECALL_WEAK_ANCHOR_PENALTY = 10

function normalizeComparable(text: string): string {
  return text.trim().toLowerCase().replace(/\/$/, '')
}

/** 标题是否只是 URL / 域名回显（典型空壳书签）。 */
export function isShellBookmarkTitle(title: string, url: string, domain: string): boolean {
  const t = normalizeComparable(title)
  if (t.length === 0) {
    return true
  }
  const u = normalizeComparable(url)
  const d = normalizeComparable(domain)
  if (t === u || t === d) {
    return true
  }
  if (t === `https://${d}` || t === `http://${d}` || t === `www.${d}`) {
    return true
  }
  // 去掉协议后与 hostname 相同
  const withoutProtocol = t.replace(/^https?:\/\//, '')
  if (withoutProtocol === d || withoutProtocol === `www.${d}`) {
    return true
  }
  return false
}

/**
 * 评估条目作为「可找回痕迹」的锚点强度。
 * - accept：可正常进召回竞争
 * - weak：可写库，但召回降权（空壳书签 / 过短摘录）
 * - reject：理论上不应存在（Zod 已拦）；供写库前 Gate 将来复用
 */
export function assessCorpusAnchorQuality(item: MemoryItem): CorpusQualityGateResult {
  if (item.type === 'text_excerpt') {
    const text = item.payload.selectedText.trim()
    if (text.length === 0) {
      return { decision: 'reject', reason: 'excerpt_empty' }
    }
    // 摘录本身即个人痕迹；过短仍 accept（空壳问题主要在书签）
    return { decision: 'accept', reason: 'excerpt_body' }
  }

  const note = item.clues.note?.trim() ?? ''
  if (note.length > 0) {
    return { decision: 'accept', reason: 'bookmark_has_note' }
  }

  const title = (item.clues.title ?? item.payload.title).trim()
  if (isShellBookmarkTitle(title, item.payload.url, item.payload.domain)) {
    return { decision: 'weak', reason: 'bookmark_shell_title' }
  }

  // 过短「标题」几乎无个人信息量（如「a」「12」）
  if (title.replace(/\s+/g, '').length < 4) {
    return { decision: 'weak', reason: 'bookmark_title_too_short' }
  }

  return { decision: 'accept', reason: 'bookmark_titled' }
}

/** 召回打分用：weak 扣分；accept/reject 不额外扣（reject 条目本不应进池）。 */
export function weakAnchorScorePenalty(item: MemoryItem): number {
  return assessCorpusAnchorQuality(item).decision === 'weak' ? RECALL_WEAK_ANCHOR_PENALTY : 0
}
