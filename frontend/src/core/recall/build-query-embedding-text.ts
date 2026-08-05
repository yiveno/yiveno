/**
 * 从口语线索 / ParsedRecallClue 拼 query embedding 文本。
 */

import type { ParsedRecallClue } from '@/core/recall/parse-recall-clue-types'

const MAX_TOTAL = 2000

/**
 * 优先用 effectiveClue；否则拼 contentTerms + raw。
 */
export function buildQueryEmbeddingText(input: {
  effectiveClue?: string
  parsed?: ParsedRecallClue
  rawClue: string
}): string {
  const effective = input.effectiveClue?.trim()
  if (effective) {
    return effective.length <= MAX_TOTAL ? effective : effective.slice(0, MAX_TOTAL)
  }
  const terms = input.parsed?.contentTerms?.filter(Boolean) ?? []
  const parts = [...terms, input.rawClue.trim()].filter(Boolean)
  const joined = parts.join(' ').trim()
  if (!joined) {
    return ''
  }
  return joined.length <= MAX_TOTAL ? joined : joined.slice(0, MAX_TOTAL)
}
