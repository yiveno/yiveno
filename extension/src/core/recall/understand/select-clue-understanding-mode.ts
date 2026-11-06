/**
 * 理解路径选择（ADR-021 · 规则层定位）。
 *
 * - 有 LLM completer：除纯 URL 外一律 `semantic`（一次听懂；禁止词面挡口语）
 * - 无 completer：一律 `lexical`（执行必走规则；mode 与 source 对齐，禁止伪 semantic 日志）
 * - `forceMode: lexical`（Omnibox）：调用方覆盖，本函数不特判入口
 *
 * 噪音过滤见 `selectClueProcessingDisposition`（Gate A）。
 */

/**
 * 理解模式。
 * - lexical：规则（无 completer / 纯 URL / Omnibox forceMode）
 * - semantic：优先 LLM（须有 completer）
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

/**
 * 选择理解模式。
 * - 空线索 / 纯 URL → lexical
 * - 有 completer → semantic（URL 除外）
 * - 无 completer → lexical（降级垫片；不是「想走 semantic 却没模型」）
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

  return 'lexical'
}
