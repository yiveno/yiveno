/**
 * 命题向量输入文本（Phase 4 §10 builder 契约）。
 * `text` ≤400 + `\n` + `sourceQuote` ≤500 → 总量 ≤1000。
 */

import { DREAMING_PROPOSITION_MAX_CHARS } from '@/core/dreaming/dreaming-constants'

/** sourceQuote 进向量时的硬上限（与 §10 契约对齐）。 */
export const DREAMING_PROPOSITION_SOURCE_QUOTE_EMBED_MAX_CHARS = 500 as const

/** 向量输入总量硬上限。 */
export const DREAMING_PROPOSITION_EMBED_TEXT_MAX_CHARS = 1000 as const

/**
 * 拼命题 embedding 请求文本。
 * 空正文 → 空串（调用方应跳过）；超长截断到契约上限。
 */
export function buildPropositionEmbeddingText(input: {
  text: string
  sourceQuote: string
}): string {
  const text = input.text.trim().slice(0, DREAMING_PROPOSITION_MAX_CHARS)
  const quote = input.sourceQuote.trim().slice(0, DREAMING_PROPOSITION_SOURCE_QUOTE_EMBED_MAX_CHARS)
  if (!text) {
    return ''
  }
  const combined = quote.length > 0 ? `${text}\n${quote}` : text
  return combined.slice(0, DREAMING_PROPOSITION_EMBED_TEXT_MAX_CHARS)
}
