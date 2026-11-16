/**
 * LLM chat usage 解析（可复用；产品路径与 eval 共用）。
 * 字段缺失记 null，禁止用 total 推算 prompt/completion。
 */

/** API / Worker 返回的 token 用量；字段缺失则为 null。 */
export type LlmChatUsage = {
  promptTokens: number | null
  completionTokens: number | null
  totalTokens: number | null
}

/** 无 usage 时的空壳。 */
export const EMPTY_LLM_CHAT_USAGE: LlmChatUsage = {
  promptTokens: null,
  completionTokens: null,
  totalTokens: null
}

/** 上游 usage 原始形状（OpenAI 兼容 / Worker 拆分响应）。 */
export type LlmChatUsageRaw = {
  prompt_tokens?: unknown
  completion_tokens?: unknown
  total_tokens?: unknown
  promptTokens?: unknown
  completionTokens?: unknown
  totalTokens?: unknown
  tokensUsed?: unknown
}

/**
 * 解析 usage：优先 snake_case（上游），其次 camelCase / tokensUsed（Worker 响应）。
 * 任一字段非 number → 该字段 null；禁止推算。
 */
export function parseLlmChatUsage(raw: LlmChatUsageRaw | null | undefined): LlmChatUsage {
  if (!raw || typeof raw !== 'object') {
    return { ...EMPTY_LLM_CHAT_USAGE }
  }
  const promptTokens =
    typeof raw.prompt_tokens === 'number'
      ? raw.prompt_tokens
      : typeof raw.promptTokens === 'number'
        ? raw.promptTokens
        : null
  const completionTokens =
    typeof raw.completion_tokens === 'number'
      ? raw.completion_tokens
      : typeof raw.completionTokens === 'number'
        ? raw.completionTokens
        : null
  const totalTokens =
    typeof raw.total_tokens === 'number'
      ? raw.total_tokens
      : typeof raw.totalTokens === 'number'
        ? raw.totalTokens
        : typeof raw.tokensUsed === 'number'
          ? raw.tokensUsed
          : null
  return { promptTokens, completionTokens, totalTokens }
}

/** detailed completer 返回值（text + usage）。 */
export type LlmChatDetailedResult = {
  text: string
  usage: LlmChatUsage
}
