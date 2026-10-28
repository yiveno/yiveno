/**
 * LLM 追问 NLG：LLM prompt → completer → JSON → Zod → 门禁映射。
 * 仅 need_a_clue；失败抛错由上层捕获后降级静态文案；不碰数据平面。
 */

import type { ParsedRecallClue } from '@/core/recall/parse-recall-clue-types'
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
  outcome: 'need_a_clue'
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
    ...(input.weakCandidateTitles !== undefined
      ? { weakCandidateTitles: input.weakCandidateTitles }
      : {})
  }
  const messages = buildLlmFollowUpMessages(promptInput)

  trace('info', 'LLM 追问：已构造 messages', {
    outcome: 'need_a_clue',
    weakCandidateCount: input.weakCandidateTitles?.length ?? 0
  })

  const rawText = await input.complete(messages, { taskKind: 'follow_up_nlg' })
  trace('info', 'LLM 追问：completer 返回', {
    preview: rawText.slice(0, 120)
  })

  const rawJson = parseJsonObjectFromLlmText(rawText)
  const proposal = LlmFollowUpProposalSchema.parse(rawJson)
  trace('info', 'LLM 追问：Zod 提议通过', {
    chipCount: proposal.chips.length
  })

  const mapped = mapLlmFollowUpProposal(proposal, {
    parsed: input.parsed,
    outcome: 'need_a_clue'
  })
  if (!mapped) {
    trace('warn', 'LLM 追问：门禁拒收提议', {
      replyPreview: proposal.reply.slice(0, 80)
    })
    throw new Error('follow_up_gate_rejected')
  }

  trace('info', 'LLM 追问：门禁通过', {
    suggestionCount: mapped.suggestions.length
  })
  return mapped
}
