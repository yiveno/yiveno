/**
 * LLM 追问 NLG：prompt → completer → JSON → Zod → 门禁映射。
 * 失败抛错由上层捕获后降级规则模板；不碰数据平面。
 */

import type { ParsedRecallClue } from '@/core/recall/parse-recall-clue-types'
import type { RecallEmptyKind, RecallOutcome } from '@/core/recall/recall-result'
import {
  buildLlmFollowUpMessages,
  type BuildLlmFollowUpPromptInput
} from '@/core/recall/understand/build-llm-follow-up-prompt'
import type { ClueFlowTrace } from '@/core/recall/understand/clue-flow-trace'
import { noopClueFlowTrace } from '@/core/recall/understand/clue-flow-trace'
import { parseJsonObjectFromLlmText } from '@/core/recall/understand/extract-llm-json'
import { LlmFollowUpProposalSchema } from '@/core/recall/understand/llm-follow-up-proposal'
import {
  mapLlmFollowUpProposal,
  type MappedLlmFollowUp
} from '@/core/recall/understand/map-llm-follow-up-proposal'
import type { LlmChatCompleter } from '@/core/recall/understand/parse-recall-clue-with-llm'

export type CompleteRecallFollowUpInput = {
  clue: string
  parsed: ParsedRecallClue
  outcome: Extract<RecallOutcome, 'need_a_clue' | 'no_match'>
  emptyKind?: RecallEmptyKind
  hasRelatedGuess?: boolean
  weakCandidateTitles?: string[]
  complete: LlmChatCompleter
  trace?: ClueFlowTrace
}

/**
 * 成功返回已门禁的追问；Zod/门禁失败抛错。
 */
export async function completeRecallFollowUpWithLlm(
  input: CompleteRecallFollowUpInput
): Promise<MappedLlmFollowUp> {
  const trace = input.trace ?? noopClueFlowTrace
  const promptInput: BuildLlmFollowUpPromptInput = {
    clue: input.clue,
    parsed: input.parsed,
    outcome: input.outcome,
    ...(input.emptyKind !== undefined ? { emptyKind: input.emptyKind } : {}),
    ...(input.hasRelatedGuess !== undefined ? { hasRelatedGuess: input.hasRelatedGuess } : {}),
    ...(input.weakCandidateTitles !== undefined
      ? { weakCandidateTitles: input.weakCandidateTitles }
      : {})
  }
  const messages = buildLlmFollowUpMessages(promptInput)

  trace('info', 'LLM 追问：已构造 messages', {
    outcome: input.outcome,
    emptyKind: input.emptyKind ?? null,
    messageCount: messages.length
  })

  const startedAt = Date.now()
  const text = await input.complete(messages)
  trace('info', 'LLM 追问：completer 返回', {
    durationMs: Date.now() - startedAt,
    textLength: text.length,
    textPreview: text.length > 200 ? `${text.slice(0, 200)}…` : text
  })

  const rawJson = parseJsonObjectFromLlmText(text)
  const proposal = LlmFollowUpProposalSchema.parse(rawJson)
  trace('info', 'LLM 追问：Zod 提议通过', {
    replyChars: proposal.reply.length,
    chipCount: proposal.chips.length
  })

  const mapped = mapLlmFollowUpProposal(proposal, {
    parsed: input.parsed,
    outcome: input.outcome,
    ...(input.emptyKind !== undefined ? { emptyKind: input.emptyKind } : {})
  })
  if (!mapped) {
    trace('warn', 'LLM 追问：门禁拒收提议', {
      outcome: input.outcome,
      emptyKind: input.emptyKind ?? null
    })
    throw new Error('follow_up_gate_rejected')
  }

  trace('info', 'LLM 追问：门禁通过', {
    suggestionCount: mapped.suggestions.length
  })
  return mapped
}
