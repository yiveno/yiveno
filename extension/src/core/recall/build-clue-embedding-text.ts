/**
 * 从口语 clue / ParsedRecallClue 拼 embedding 请求文本。
 */

import { RECALL_GENERIC_CLUE_TERMS } from '@/core/recall/keyword-filter'
import type { ParsedRecallClue } from '@/core/recall/parse-recall-clue-types'

const MAX_TOTAL = 2000

const MOVIE_HINT_TERMS = new Set(['movie', 'movies', 'film', 'films', 'video', 'videos'])

/**
 * 有非泛词 contentTerms 时：只用锚点词（+ 可选 movie 类型提示），不拼整句口语。
 * 整句含 review/saved 等会把向量拉向无关「Weekly review」/小品影评，冲淡 atomic/bomb。
 */
export function buildClueEmbeddingText(input: {
  effectiveClue?: string
  parsed?: ParsedRecallClue
  rawClue: string
}): string {
  const effective = (input.effectiveClue?.trim() || input.rawClue.trim()).trim()
  const terms = input.parsed?.contentTerms?.map(term => term.trim()).filter(Boolean) ?? []
  const specificTerms = terms.filter(term => !RECALL_GENERIC_CLUE_TERMS.has(term.toLowerCase()))

  let joined: string
  if (specificTerms.length > 0) {
    const hints: string[] = []
    const wantsMovie =
      input.parsed?.objectTypes?.includes('video') === true ||
      terms.some(term => MOVIE_HINT_TERMS.has(term.toLowerCase())) ||
      /\b(movie|film|video)s?\b/i.test(effective)
    if (wantsMovie) {
      hints.push('movie')
    }
    joined = [...new Set([...specificTerms, ...hints])].join(' ').trim()
  } else if (terms.length > 0) {
    joined = terms.join(' ').trim()
  } else {
    joined = effective
  }

  if (!joined) {
    return ''
  }
  return joined.length <= MAX_TOTAL ? joined : joined.slice(0, MAX_TOTAL)
}
