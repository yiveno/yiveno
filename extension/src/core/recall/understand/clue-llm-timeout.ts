/**
 * 线索理解 LLM completer 硬超时（§7.0 在线弱网）。
 * 超时 → Abort → understand 层 rules_fallback；禁止无限挂起。
 */

/** Side Panel 线索理解 fetch 预算（毫秒）。 */
export const CLUE_LLM_COMPLETE_TIMEOUT_MS = 12_000
