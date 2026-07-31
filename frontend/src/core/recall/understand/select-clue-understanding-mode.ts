/**
 * 线索理解门禁：决定走词面快路径还是语义深理解（LLM）。
 * 调度本身确定性，不交给模型自选路径。
 */

export type ClueUnderstandingMode = 'lexical' | 'semantic'

function isUrlLike(raw: string): boolean {
  const trimmed = raw.trim()
  if (/^(https?:\/\/|www\.)/i.test(trimmed)) {
    return true
  }
  return /^[\w.-]+\.[a-z]{2,}([/:?#].*)?$/i.test(trimmed)
}

/** 明显口语 / 残缺叙述信号。 */
const NATURAL_LANGUAGE_SIGNAL =
  /\b(i|i'm|i've|i'd|could you|can you|please|forgot|forgotten|remember|looking for|came across|the one|that i|help me|about a|recently)\b/i

/**
 * 根据线索形态选择理解模式。
 * - lexical：短词面 / URL / 专名倾向 → 规则即可
 * - semantic：长句 / 疑问 / 口语信号 → 应升 LLM（无模型时降级规则）
 */
export function selectClueUnderstandingMode(clue: string): ClueUnderstandingMode {
  const raw = clue.trim()
  if (!raw) {
    return 'lexical'
  }

  if (isUrlLike(raw)) {
    return 'lexical'
  }

  const words = raw.split(/\s+/).filter(Boolean)
  if (words.length <= 2 && raw.length <= 48) {
    return 'lexical'
  }

  if (NATURAL_LANGUAGE_SIGNAL.test(raw) || raw.includes('?') || words.length >= 5) {
    return 'semantic'
  }

  return 'lexical'
}
