/**
 * 理解路径选择（有 LLM 时默认 semantic；规则仅降级）。
 * 产品 §0.1.0：听懂靠 LLM；禁止用词面启发式把口语挡在模型外。
 * 噪音过滤见 selectClueProcessingDisposition（Gate A）。
 */

/**
 * 理解模式。
 * - lexical：规则（无 completer / 纯 URL 等廉价例外）
 * - semantic：优先 LLM
 */
export type ClueUnderstandingMode =
  | 'lexical' // 词面：规则解析
  | 'semantic' // 语义：优先 LLM

export type SelectClueUnderstandingModeOptions = {
  /** 是否有可用 LLM completer（托管 / 开发直连） */
  hasLlmCompleter?: boolean
}

function isUrlLike(raw: string): boolean {
  const trimmed = raw.trim()
  if (/^(https?:\/\/|www\.)/i.test(trimmed)) {
    return true
  }
  return /^[\w.-]+\.[a-z]{2,}([/:?#].*)?$/i.test(trimmed)
}

/** 无 LLM 时的降级启发式：明显英语口语 / 时间仍标 semantic（便于日志；实际仍走规则）。 */
const ORAL_OR_TIME_INTENT_SIGNAL =
  /day before yesterday|yesterday|last week|a while ago|long ago|the other day|recently|\btoday\b/i

const ENGLISH_NATURAL_LANGUAGE_SIGNAL =
  /\b(i|i'm|i've|i'd|could you|can you|please|forgot|forgotten|remember|looking for|came across|the one|that i|help me|about a|recently)\b/i

/**
 * 选择理解模式。
 * - 有 completer：除纯 URL 外一律 semantic（一次听懂，不双扫）
 * - 无 completer：降级启发式（仅影响日志 / 强制模式语义；执行仍走规则）
 */
export function selectClueUnderstandingMode(
  clue: string,
  options: SelectClueUnderstandingModeOptions = {}
): ClueUnderstandingMode {
  const raw = clue.trim()
  if (!raw) {
    return 'lexical'
  }

  if (isUrlLike(raw)) {
    return 'lexical'
  }

  if (options.hasLlmCompleter) {
    return 'semantic'
  }

  // —— 以下仅无 LLM 降级路径的形态标注 ——
  if (
    ENGLISH_NATURAL_LANGUAGE_SIGNAL.test(raw) ||
    ORAL_OR_TIME_INTENT_SIGNAL.test(raw) ||
    raw.includes('?')
  ) {
    return 'semantic'
  }

  const words = raw.split(/\s+/).filter(Boolean)
  if (words.length <= 2 && raw.length <= 48) {
    return 'lexical'
  }
  if (words.length >= 5) {
    return 'semantic'
  }
  return 'lexical'
}
