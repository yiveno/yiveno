import { buildLlmParseClueMessages } from '@/core/recall/understand/build-llm-parse-prompt'
import { type ClueFlowTrace, noopClueFlowTrace } from '@/core/recall/understand/clue-flow-trace'
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
  trace?: ClueFlowTrace
}

/**
 * LLM 口语 → ParsedRecallClue。
 * 流程：prompt → 文本 → JSON → Zod 提议 → 确定性映射。不碰数据平面。
 */
export async function parseRecallClueWithLlm(
  clue: string,
  options: ParseRecallClueWithLlmOptions
): Promise<ParsedRecallClue> {
  const nowMs = options.nowMs ?? PARSE_GOLD_NOW_MS
  const trace = options.trace ?? noopClueFlowTrace
  const messages = buildLlmParseClueMessages(clue)

  trace('info', 'LLM 解析：已构造 messages', {
    messageCount: messages.length,
    systemChars: messages[0]?.content.length ?? 0,
    userChars: messages[1]?.content.length ?? 0
  })

  const startedAt = Date.now()
  const text = await options.complete(messages)
  trace('info', 'LLM 解析：completer 返回', {
    durationMs: Date.now() - startedAt,
    textLength: text.length,
    textPreview: text.length > 240 ? `${text.slice(0, 240)}…` : text
  })

  const rawJson = parseJsonObjectFromLlmText(text)
  trace('info', 'LLM 解析：已抽取 JSON', {
    keys: Object.keys(rawJson)
  })

  const proposal = LlmParsedClueProposalSchema.parse(rawJson)
  trace('info', 'LLM 解析：Zod 提议通过', {
    timeLabel: proposal.timeLabel ?? null,
    objectTypes: proposal.objectTypes ?? null,
    behaviorHints: proposal.behaviorHints ?? null,
    noteHint: proposal.noteHint ?? false,
    contentTerms: proposal.contentTerms,
    confidence: proposal.confidence
  })

  const mapped = mapLlmProposalToParsedClue(clue, proposal, nowMs)
  trace('info', 'LLM 解析：已映射 ParsedRecallClue', {
    contentTerms: mapped.contentTerms,
    timeLabel: mapped.timeRange?.label ?? null,
    timeFrom: mapped.timeRange?.from ?? null,
    timeTo: mapped.timeRange?.to ?? null,
    objectTypes: mapped.objectTypes ?? null,
    confidence: mapped.confidence
  })
  return mapped
}

/** 用 OpenAI 兼容配置构造 completer。 */
export function createOpenAiCompatibleCompleter(
  config: OpenAiCompatibleChatConfig
): LlmChatCompleter {
  return messages => completeOpenAiCompatibleChat(config, messages)
}
