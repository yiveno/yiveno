/**
 * 追问芯片展示门禁（P0 · 2026-10-29）：
 * 1) 邻域互异组过窄 → 不挂 LLM/环境芯片（避免 N=1 确认式鸡肋）
 * 2) 芯片须对当前候选有切割力；无区分度 / 纯「记不清」元芯片丢弃
 */

import type { MemoryItem } from '@/core/memory/memory-item'
import {
  getMemoryItemDisplay,
  type RecallMatch,
  type RecallResult
} from '@/core/recall/recall-result'

/** 至少几条互异候选才值得挂收窄芯片。 */
export const RECALL_FOLLOW_UP_CHIP_MIN_DISTINCT = 2

/** 词面命中候选条数：须部分覆盖才算切开（非全中、非全不中）。 */
const MIN_PARTIAL_HIT = 1

/** 闭集类型 value → 无法靠标题字面切开时，用条目 type / tags 判断。 */
const TYPE_LIKE_CHIP_VALUES = new Set([
  'article',
  'poem',
  'code',
  'song',
  'video',
  'command',
  'page',
  'password',
  'quote',
  'bookmark',
  'bookmarks',
  'excerpt',
  'excerpts',
  'note',
  'notes'
])

/** 无切割力的元确认类 value（英文稳定串）。 */
const NON_CUTTING_META_VALUES = new Set([
  'i dont remember',
  "i don't remember",
  'dont remember',
  "don't remember",
  'cannot remember',
  "can't remember",
  'not sure',
  'maybe',
  'unclear',
  'forgot',
  'i forget',
  'no idea',
  'idk',
  'unsure',
  'hard to say'
])

export type FollowUpChipLike = {
  id: string
  label: string
  value: string
}

/** 折叠比较用（小写、压空白、统一撇号）。 */
export function foldFollowUpChipValue(value: string): string {
  return value.trim().toLowerCase().replace(/['’]/g, "'").replace(/\s+/g, ' ')
}

/**
 * 本轮可用于芯片门禁的候选条数。
 * 优先 `totalRankedCount`（整池互异组）；否则用已持有 shortlist。
 */
export function countRecallFollowUpChipEligibleCandidates(
  result: Pick<RecallResult, 'totalRankedCount' | 'topPick' | 'alsoPossible'>
): number {
  if (result.totalRankedCount > 0) {
    return result.totalRankedCount
  }
  return (result.topPick ? 1 : 0) + result.alsoPossible.length
}

/** 邻域是否宽到值得挂收窄芯片。 */
export function shouldOfferRecallFollowUpChips(candidateCount: number): boolean {
  return candidateCount >= RECALL_FOLLOW_UP_CHIP_MIN_DISTINCT
}

/** 是否「记不清 / 不确定」类无切割元芯片。 */
export function isNonCuttingFollowUpMetaValue(value: string): boolean {
  const folded = foldFollowUpChipValue(value)
  if (!folded) {
    return true
  }
  if (NON_CUTTING_META_VALUES.has(folded)) {
    return true
  }
  if (/^(i )?(don'?t|cannot|can'?t) remember\b/.test(folded)) {
    return true
  }
  if (/^not sure\b/.test(folded) || /^no idea\b/.test(folded)) {
    return true
  }
  return false
}

/** 从命中条目抽可比较语料（展示字段 / 附注 / tags / keywords）。 */
export function buildFollowUpChipCandidateCorpus(item: MemoryItem): string {
  const display = getMemoryItemDisplay(item, () => '')
  const clues = item.clues
  const parts = [
    display.title,
    display.excerpt ?? '',
    display.subtitle,
    display.url,
    display.note ?? '',
    item.type,
    ...(clues.tags ?? []),
    ...(clues.keywords ?? []),
    clues.domain ?? '',
    clues.sourceUrl ?? ''
  ]
  return foldFollowUpChipValue(parts.filter(Boolean).join(' '))
}

function collectPoolMatches(result: Pick<RecallResult, 'topPick' | 'alsoPossible'>): RecallMatch[] {
  return [...(result.topPick ? [result.topPick] : []), ...result.alsoPossible]
}

function itemMatchesTypeLikeChip(item: MemoryItem, foldedValue: string): boolean {
  if (foldedValue === 'bookmark' || foldedValue === 'bookmarks') {
    return item.type === 'bookmark'
  }
  if (foldedValue === 'excerpt' || foldedValue === 'excerpts' || foldedValue === 'quote') {
    return item.type === 'text_excerpt' || (item.clues?.tags ?? []).includes('quote')
  }
  if (foldedValue === 'note' || foldedValue === 'notes') {
    return Boolean(item.clues?.note?.trim())
  }
  const tags = (item.clues?.tags ?? []).map(tag => tag.toLowerCase())
  if (tags.includes(foldedValue)) {
    return true
  }
  // 类型 canonical 偶发写在 enrichment tags
  return tags.some(tag => tag === foldedValue || tag.endsWith(`:${foldedValue}`))
}

/**
 * value 是否切开候选池：命中部分（≥1）且非全部。
 * 类型类芯片走条目 type/tags；其余走语料字面包含。
 */
export function doesFollowUpChipValueCutCandidates(
  value: string,
  matches: readonly RecallMatch[]
): boolean {
  if (matches.length < RECALL_FOLLOW_UP_CHIP_MIN_DISTINCT) {
    return false
  }
  if (isNonCuttingFollowUpMetaValue(value)) {
    return false
  }

  const folded = foldFollowUpChipValue(value)
  if (!folded) {
    return false
  }

  let hitCount = 0
  if (TYPE_LIKE_CHIP_VALUES.has(folded)) {
    for (const match of matches) {
      if (itemMatchesTypeLikeChip(match.item, folded)) {
        hitCount += 1
      }
    }
  } else {
    const tokens = folded.split(' ').filter(token => token.length >= 2)
    if (tokens.length === 0) {
      return false
    }
    for (const match of matches) {
      const corpus = buildFollowUpChipCandidateCorpus(match.item)
      if (tokens.some(token => corpus.includes(token))) {
        hitCount += 1
      }
    }
  }

  return hitCount >= MIN_PARTIAL_HIT && hitCount < matches.length
}

/**
 * 过滤无切割力芯片；邻域过窄时返回空数组。
 */
export function filterRecallFollowUpChipsByCutPower<T extends FollowUpChipLike>(
  chips: readonly T[],
  result: Pick<RecallResult, 'totalRankedCount' | 'topPick' | 'alsoPossible'>
): T[] {
  const count = countRecallFollowUpChipEligibleCandidates(result)
  if (!shouldOfferRecallFollowUpChips(count)) {
    return []
  }
  const matches = collectPoolMatches(result)
  if (matches.length < RECALL_FOLLOW_UP_CHIP_MIN_DISTINCT) {
    // 整池 N≥2 但 shortlist 不足时：仍丢掉元芯片；字面切开用 shortlist 尽力判断
    return chips.filter(chip => !isNonCuttingFollowUpMetaValue(chip.value))
  }
  return chips.filter(chip => doesFollowUpChipValueCutCandidates(chip.value, matches))
}
