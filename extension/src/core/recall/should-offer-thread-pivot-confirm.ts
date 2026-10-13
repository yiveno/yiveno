/**
 * 软岔路口启发式：像不像「新找」——只决定是否弹出确认，绝不静默清线程。
 * 规则保守、字面可测；禁止开放话题分类 / LLM 猜切换。
 */

import { parseRecallClue } from '@/core/recall/parse-recall-clue'

/** 距上次提交冷却后，才允许「短句但无重叠」触发确认。 */
export const THREAD_PIVOT_COOLDOWN_MS = 5 * 60 * 1000

/** 内容词达到此数且与锚点无重叠 → 视为足够像新找。 */
export const THREAD_PIVOT_MIN_CONTENT_TERMS = 2

/** 原文长度达到此数且与锚点无重叠 → 视为足够像新找。 */
export const THREAD_PIVOT_MIN_CHARS = 28

/** 冷却路径：至少这么多词才弹确认（避免单字 refine 如 history）。 */
export const THREAD_PIVOT_COOLDOWN_MIN_WORDS = 3

export type CollectThreadAnchorTermsInput = {
  contentTerms?: readonly string[]
  priorUserUtterances?: readonly string[]
}

export type ShouldOfferThreadPivotConfirmInput = {
  clue: string
  anchorTerms: readonly string[]
  lastSubmitAtMs: number | null
  nowMs: number
  cooldownMs?: number
}

/** 收集锚点可比对的折叠词（小写）；优先 accumulated contentTerms，并吸收 prior 句的 contentTerms。 */
export function collectThreadAnchorTerms(input: CollectThreadAnchorTermsInput): string[] {
  const seen = new Set<string>()
  const out: string[] = []

  const pushAll = (terms: readonly string[]): void => {
    for (const term of terms) {
      const key = term.trim().toLowerCase()
      if (!key || seen.has(key)) {
        continue
      }
      seen.add(key)
      out.push(key)
    }
  }

  pushAll(input.contentTerms ?? [])

  for (const utterance of input.priorUserUtterances ?? []) {
    const trimmed = utterance.trim()
    if (!trimmed) {
      continue
    }
    pushAll(parseRecallClue(trimmed).contentTerms)
  }

  return out
}

function countWords(clue: string): number {
  return clue.trim().split(/\s+/).filter(Boolean).length
}

function hasLiteralOverlap(clueTerms: readonly string[], anchorTerms: readonly string[]): boolean {
  if (clueTerms.length === 0 || anchorTerms.length === 0) {
    return false
  }
  const anchor = new Set(anchorTerms.map(term => term.toLowerCase()))
  return clueTerms.some(term => anchor.has(term.toLowerCase()))
}

/**
 * 是否应在发送前出示 Keep refining / Start new。
 * 无锚点词、有字面重叠、或线索太像短收窄 → false。
 */
export function shouldOfferThreadPivotConfirm(input: ShouldOfferThreadPivotConfirmInput): boolean {
  const trimmed = input.clue.trim()
  if (!trimmed || input.anchorTerms.length === 0) {
    return false
  }

  const parsed = parseRecallClue(trimmed)
  const clueTerms = parsed.contentTerms
  if (hasLiteralOverlap(clueTerms, input.anchorTerms)) {
    return false
  }

  const wordCount = countWords(trimmed)
  const substantial =
    clueTerms.length >= THREAD_PIVOT_MIN_CONTENT_TERMS || trimmed.length >= THREAD_PIVOT_MIN_CHARS

  const cooldownMs = input.cooldownMs ?? THREAD_PIVOT_COOLDOWN_MS
  const idleMs =
    input.lastSubmitAtMs === null ? Number.POSITIVE_INFINITY : input.nowMs - input.lastSubmitAtMs
  const cooledPivot =
    idleMs >= cooldownMs && wordCount >= THREAD_PIVOT_COOLDOWN_MIN_WORDS && clueTerms.length >= 1

  return substantial || cooledPivot
}
