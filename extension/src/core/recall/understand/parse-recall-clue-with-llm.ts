import { buildLlmParseClueMessages } from '@/core/recall/understand/build-llm-parse-prompt'
import { type ClueFlowTrace, noopClueFlowTrace } from '@/core/recall/understand/clue-flow-trace'
import { parseJsonObjectFromLlmText } from '@/core/recall/understand/extract-llm-json'
import { getCachedLlmParse, setCachedLlmParse } from '@/core/recall/understand/llm-parse-cache'
import { LlmParsedClueProposalSchema } from '@/core/recall/understand/llm-parsed-clue-proposal'
import { mapLlmProposalToParsedClue } from '@/core/recall/understand/map-llm-proposal-to-parsed'
import {
  completeOpenAiCompatibleChat,
  type OpenAiCompatibleChatConfig
} from '@/core/recall/understand/openai-compatible-chat'
import { PARSE_GOLD_NOW_MS } from '@/core/recall/eval/parse-gold-now'
import type { ParsedRecallClue } from '@/core/recall/parse-recall-clue-types'
import type { LlmChatCompleteOptions } from '@/core/recall/understand/ai-chat-task-kind'

/** 可注入的补全函数（单测 mock / 真 API）；须带 taskKind。 */
export type LlmChatCompleter = (
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options: LlmChatCompleteOptions
) => Promise<string>

export interface ParseRecallClueWithLlmOptions {
  nowMs?: number
  complete: LlmChatCompleter
  trace?: ClueFlowTrace
}

/**
 * LLM 口语 → ParsedRecallClue。
 * 流程：LLM prompt → 文本 → JSON → Zod 提议 → 确定性映射。不碰数据平面。
 *
 * 缓存策略：同 clue 5min 内复用 LLM proposal（时间相关字段仍按调用方 nowMs 重算）。
 * 见 `llm-parse-cache.ts`。
 */
export async function parseRecallClueWithLlm(
  clue: string,
  options: ParseRecallClueWithLlmOptions
): Promise<ParsedRecallClue> {
  const nowMs = options.nowMs ?? PARSE_GOLD_NOW_MS
  const trace = options.trace ?? noopClueFlowTrace
  const messages = buildLlmParseClueMessages(clue)

  // 1) cache 命中：跳过 LLM，直接用 proposal + 当前 nowMs 重算 timeRange
  const cached = getCachedLlmParse(clue, { nowMs })
  if (cached) {
    trace('info', 'LLM 解析：cache 命中，跳过 completer', {
      clue,
      contentTerms: cached.contentTerms
    })
    return mapLlmProposalToParsedClue(clue, cached, nowMs)
  }

  trace('info', 'LLM 解析：已构造 messages', {
    messageCount: messages.length,
    systemChars: messages[0]?.content.length ?? 0,
    userChars: messages[1]?.content.length ?? 0
  })

  const startedAt = Date.now()
  const text = await options.complete(messages, { taskKind: 'nlu' })
  trace('info', 'LLM 解析：completer 返回', {
    durationMs: Date.now() - startedAt,
    textLength: text.length,
    textPreview: text.length > 240 ? `${text.slice(0, 240)}…` : text
  })

  const rawJson = parseJsonObjectFromLlmText(text)
  const jsonKeys =
    rawJson !== null && typeof rawJson === 'object' && !Array.isArray(rawJson)
      ? Object.keys(rawJson as Record<string, unknown>)
      : []
  trace('info', 'LLM 解析：已抽取 JSON', {
    keys: jsonKeys
  })

  const proposal = LlmParsedClueProposalSchema.parse(rawJson)
  // 2) 写入 cache（不含时间戳；下次复用）
  setCachedLlmParse(clue, proposal, { nowMs: Date.now() })
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

/** 用 OpenAI 兼容配置构造 completer（开发直连；忽略 taskKind，仅本地调试）。 */
export function createOpenAiCompatibleCompleter(
  config: OpenAiCompatibleChatConfig
): LlmChatCompleter {
  return (messages, _options) => completeOpenAiCompatibleChat(config, messages)
}
