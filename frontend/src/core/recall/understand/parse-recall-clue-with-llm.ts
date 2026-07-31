import { buildLlmParseClueMessages } from '@/core/recall/understand/build-llm-parse-prompt'
import { parseJsonObjectFromLlmText } from '@/core/recall/understand/extract-llm-json'
import { LlmParsedClueProposalSchema } from '@/core/recall/understand/llm-parsed-clue-proposal'
import { mapLlmProposalToParsedClue } from '@/core/recall/understand/map-llm-proposal-to-parsed'
import {
  completeOpenAiCompatibleChat,
  type OpenAiCompatibleChatConfig
} from '@/core/recall/understand/openai-compatible-chat'
import { PARSE_GOLD_NOW_MS } from '@/core/recall/eval/parse-gold-now'
import type { ParsedRecallClue } from '@/core/recall/parse-recall-clue-types'

/** 可注入的补全函数（单测 mock / 真 API）。 */
export type LlmChatCompleter = (
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
) => Promise<string>

export interface ParseRecallClueWithLlmOptions {
  nowMs?: number
  complete: LlmChatCompleter
}

/**
 * LLM 口语 → ParsedRecallClue（eval 专用）。
 * 流程：prompt → 文本 → JSON → Zod 提议 → 确定性映射。不碰数据平面。
 */
export async function parseRecallClueWithLlm(
  clue: string,
  options: ParseRecallClueWithLlmOptions
): Promise<ParsedRecallClue> {
  const nowMs = options.nowMs ?? PARSE_GOLD_NOW_MS
  const messages = buildLlmParseClueMessages(clue)
  const text = await options.complete(messages)
  const rawJson = parseJsonObjectFromLlmText(text)
  const proposal = LlmParsedClueProposalSchema.parse(rawJson)
  return mapLlmProposalToParsedClue(clue, proposal, nowMs)
}

/** 用 OpenAI 兼容配置构造 completer。 */
export function createOpenAiCompatibleCompleter(
  config: OpenAiCompatibleChatConfig
): LlmChatCompleter {
  return messages => completeOpenAiCompatibleChat(config, messages)
}
