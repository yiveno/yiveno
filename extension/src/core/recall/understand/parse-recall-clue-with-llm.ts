import {
  buildChitchatReplyMessages,
  CHITCHAT_REPLY_TEMPERATURE
} from '@/core/recall/understand/build-chitchat-reply-prompt'
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
import type { ParsedRecallClue, RecallClueIntent } from '@/core/recall/parse-recall-clue-types'
import type { LlmChatCompleteOptions } from '@/core/recall/understand/ai-chat-task-kind'
import type { LlmParsedClueProposal } from '@/core/recall/understand/llm-parsed-clue-proposal'

/** 非召回意图：走二次回复 + 短路，不进检索。 */
function isNonRecallIntent(
  intent: RecallClueIntent | undefined
): intent is 'chitchat' | 'question' | 'instruction' {
  return intent === 'chitchat' || intent === 'question' || intent === 'instruction'
}

/** 可注入的补全函数（单测 mock / 真 API）；须带 taskKind。 */
export type LlmChatCompleter = (
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options: LlmChatCompleteOptions
) => Promise<string>

export interface ParseRecallClueWithLlmOptions {
  nowMs?: number
  complete: LlmChatCompleter
  trace?: ClueFlowTrace
  /**
   * 是否读写 `llm-parse-cache`（默认 true，生产路径）。
   * 离线换模对比须 false：缓存键不含 model，避免串用他模 proposal。
   */
  useCache?: boolean
}

/**
 * 非召回回复第二次调用：temperature 0.8；任何失败返回 null（调用方回落，不抛错）。
 */
async function refreshChitchatReply(args: {
  clue: string
  complete: LlmChatCompleter
  intent: RecallClueIntent
  previousReply?: string
  nowMs?: number
  trace: ClueFlowTrace
}): Promise<string | null> {
  const { clue, complete, intent, previousReply, nowMs, trace } = args
  const startedAt = Date.now()
  try {
    const messages = buildChitchatReplyMessages(clue, {
      intent,
      ...(previousReply !== undefined ? { previousReply } : {}),
      ...(nowMs !== undefined ? { nowMs } : {})
    })
    const text = await complete(messages, {
      taskKind: 'nlu',
      temperature: CHITCHAT_REPLY_TEMPERATURE
    })
    const trimmed = text.trim()
    if (!trimmed) {
      trace('warn', 'LLM 非召回回复：空回复，回落', {
        durationMs: Date.now() - startedAt,
        reason: 'empty',
        hasPreviousReply: Boolean(previousReply?.trim())
      })
      return null
    }
    trace('info', 'LLM 非召回回复：completer 返回', {
      durationMs: Date.now() - startedAt,
      textLength: trimmed.length,
      hasPreviousReply: Boolean(previousReply?.trim())
    })
    return trimmed
  } catch (error) {
    const aborted =
      (error instanceof DOMException && error.name === 'TimeoutError') ||
      (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError'))
    trace('warn', 'LLM 非召回回复：失败，回落', {
      durationMs: Date.now() - startedAt,
      reason: aborted ? 'timeout' : 'error',
      hasPreviousReply: Boolean(previousReply?.trim()),
      error: error instanceof Error ? error.message : String(error)
    })
    return null
  }
}

/**
 * LLM 口语 → ParsedRecallClue。
 * 流程：LLM prompt → 文本 → JSON → Zod 提议 →（非召回则二次生成回复）→ 确定性映射。不碰数据平面。
 *
 * 缓存策略：同 clue 5min 内复用 LLM proposal（时间相关字段仍按调用方 nowMs 重算）。
 * 非召回回复每次另调 temperature 0.8；缓存内回复仅作「上一句」提示与失败回落。
 * 见 `llm-parse-cache.ts`。换 completer / 换模型前须 `clearLlmParseCache()`，或设 `useCache: false`。
 */
export async function parseRecallClueWithLlm(
  clue: string,
  options: ParseRecallClueWithLlmOptions
): Promise<ParsedRecallClue> {
  const nowMs = options.nowMs ?? PARSE_GOLD_NOW_MS
  const trace = options.trace ?? noopClueFlowTrace
  const useCache = options.useCache !== false
  const messages = buildLlmParseClueMessages(clue)

  // 1) cache 命中：跳过解析 LLM；非召回仍二次生成回复
  if (useCache) {
    const cached = getCachedLlmParse(clue, { nowMs })
    if (cached) {
      trace('info', 'LLM 解析：cache 命中，跳过 completer', {
        clue,
        contentTerms: cached.contentTerms
      })
      if (isNonRecallIntent(cached.intent)) {
        const previousReply = cached.assistantReply?.trim() ? cached.assistantReply : undefined
        const fresh = await refreshChitchatReply({
          clue,
          complete: options.complete,
          intent: cached.intent,
          ...(previousReply !== undefined ? { previousReply } : {}),
          nowMs,
          trace
        })
        const proposalForMap: LlmParsedClueProposal = fresh
          ? { ...cached, assistantReply: fresh }
          : cached
        return mapLlmProposalToParsedClue(clue, proposalForMap, nowMs)
      }
      return mapLlmProposalToParsedClue(clue, cached, nowMs)
    }
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

  // 非召回：写缓存前二次生成回复（失败则保留提议原回复）
  if (isNonRecallIntent(proposal.intent)) {
    const previousReply = proposal.assistantReply?.trim() ? proposal.assistantReply : undefined
    const fresh = await refreshChitchatReply({
      clue,
      complete: options.complete,
      intent: proposal.intent,
      ...(previousReply !== undefined ? { previousReply } : {}),
      nowMs,
      trace
    })
    if (fresh) {
      proposal.assistantReply = fresh
    }
  }

  // 2) 写入 cache（不含时间戳；下次复用；非召回缓存回复仅作提示/回落）
  if (useCache) {
    setCachedLlmParse(clue, proposal, { nowMs: Date.now() })
  }
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
  return (messages, options) => {
    const temperature = options.temperature ?? config.temperature
    return completeOpenAiCompatibleChat(
      temperature === undefined ? config : { ...config, temperature },
      messages
    )
  }
}
