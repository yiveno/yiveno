/**
 * 线索理解门禁（Gate B）：决定走词面快路径还是语义深理解（LLM）。
 * 调度本身确定性，不交给模型自选路径。
 * 不负责噪音过滤；「是否处理」见 selectClueProcessingDisposition（Gate A）。
 *
 * 注意：规则词典仍以英语为主语料（产品 §0.1.1）；此处中文信号只用于「升 LLM」，
 * 不把中文 surface 写进 canonical lexicon。
 */

/**
 * 理解门禁模式（Gate B）。
 * - lexical：词面快路径（规则）
 * - semantic：语义深理解（可升 LLM）
 */
export type ClueUnderstandingMode =
  | 'lexical' // 词面：规则解析
  | 'semantic' // 语义：优先 LLM

function isUrlLike(raw: string): boolean {
  const trimmed = raw.trim()
  if (/^(https?:\/\/|www\.)/i.test(trimmed)) {
    return true
  }
  return /^[\w.-]+\.[a-z]{2,}([/:?#].*)?$/i.test(trimmed)
}

function countHanChars(raw: string): number {
  return (raw.match(/\p{Script=Han}/gu) ?? []).length
}

/** 明显英语口语 / 残缺叙述信号。 */
const ENGLISH_NATURAL_LANGUAGE_SIGNAL =
  /\b(i|i'm|i've|i'd|could you|can you|please|forgot|forgotten|remember|looking for|came across|the one|that i|help me|about a|recently)\b/i

/**
 * 相对时间 / 找回意图信号（中英；仅 Gate B / miss 升级用）。
 * 不含孤立类型词（如单独「电影」），避免专名式短词误升 LLM。
 */
const ORAL_OR_TIME_INTENT_SIGNAL =
  /昨天|前天|今天|上周|最近|前一阵|很久以前|找一下|帮我找|那篇|那个|哪篇|哪个|day before yesterday|yesterday|last week|a while ago|long ago|the other day|recently|\btoday\b/i

/**
 * 线索是否带「更像口语约束、规则词典难单独扛」的信号。
 * 供 Gate B 与 lexical miss 升级共用。
 */
export function hasOralOrTimeIntentSignal(clue: string): boolean {
  const raw = clue.trim()
  if (!raw) {
    return false
  }
  if (ENGLISH_NATURAL_LANGUAGE_SIGNAL.test(raw) || ORAL_OR_TIME_INTENT_SIGNAL.test(raw)) {
    return true
  }
  if (raw.includes('?') || raw.includes('？')) {
    return true
  }
  // 无空格中文短句：按汉字数估复杂度（「前天的电影」=5 → 升）
  if (countHanChars(raw) >= 4) {
    return true
  }
  return false
}

/**
 * 根据线索形态选择理解模式。
 * - lexical：短词面 / URL / 英文专名倾向 → 规则即可
 * - semantic：口语 / 疑问 / 相对时间意图 / 中文短句 → 应升 LLM（无模型时降级规则）
 */
export function selectClueUnderstandingMode(clue: string): ClueUnderstandingMode {
  const raw = clue.trim()
  if (!raw) {
    return 'lexical'
  }

  if (isUrlLike(raw)) {
    return 'lexical'
  }

  if (hasOralOrTimeIntentSignal(raw)) {
    return 'semantic'
  }

  const words = raw.split(/\s+/).filter(Boolean)
  const hanCount = countHanChars(raw)

  // 短英文词面 / 专名（无汉字）
  if (hanCount === 0 && words.length <= 2 && raw.length <= 48) {
    return 'lexical'
  }

  if (words.length >= 5) {
    return 'semantic'
  }

  return 'lexical'
}

/**
 * lexical 扫库 no_match 后，是否值得强制升一次 semantic（有 completer 时）。
 * 保守：URL / 纯短英文专名不升；有口语·时间信号或 ≥3 英文词可升。
 */
export function shouldEscalateLexicalNoMatch(clue: string): boolean {
  const raw = clue.trim()
  if (!raw || isUrlLike(raw)) {
    return false
  }
  if (hasOralOrTimeIntentSignal(raw)) {
    return true
  }
  const words = raw.split(/\s+/).filter(Boolean)
  if (countHanChars(raw) === 0 && words.length >= 3) {
    return true
  }
  return false
}
