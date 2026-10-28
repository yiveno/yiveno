/**
 * LLM Framing NLG：用已算好的 RecallFramingFacts 润色 P1–P5 气泡正文。
 * P6 计数仍由规则层 deterministic 拼接；芯片仅 need_a_clue。
 */

import type { ParsedRecallClue } from '@/core/recall/parse-recall-clue-types'
import type { RecallFramingFacts } from '@/core/recall/recall-framing-facts'
import type { RecallOutcome } from '@/core/recall/recall-result'
import type { ClueFlowTrace } from '@/core/recall/understand/clue-flow-trace'
import { noopClueFlowTrace } from '@/core/recall/understand/clue-flow-trace'
import {
  buildLlmFramingMessages,
  type BuildLlmFramingPromptInput
} from '@/core/recall/understand/build-llm-framing-prompt'
import { parseJsonObjectFromLlmText } from '@/core/recall/understand/extract-llm-json'
import { LlmFollowUpProposalSchema } from '@/core/recall/understand/llm-follow-up-proposal'
import {
  mapLlmFollowUpProposal,
  type MappedLlmFollowUp
} from '@/core/recall/understand/map-llm-follow-up-proposal'
import type { LlmChatCompleter } from '@/core/recall/understand/parse-recall-clue-with-llm'

export type CompleteRecallFramingNlgInput = {
  clue: string
  parsed: ParsedRecallClue
  outcome: RecallOutcome
  facts: RecallFramingFacts
  rulesBaseline: string
  weakCandidateTitles?: string[]
  complete: LlmChatCompleter
  trace?: ClueFlowTrace
}

/**
 * LLM 润色 Framing P1–P5；失败抛错由上层降级规则模板。
 */
export async function completeRecallFramingNlgWithLlm(
  input: CompleteRecallFramingNlgInput
): Promise<MappedLlmFollowUp> {
  const trace = input.trace ?? noopClueFlowTrace
  const promptInput: BuildLlmFramingPromptInput = {
    clue: input.clue,
    parsed: input.parsed,
    outcome: input.outcome,
    facts: input.facts,
    rulesBaseline: input.rulesBaseline,
    ...(input.weakCandidateTitles !== undefined
      ? { weakCandidateTitles: input.weakCandidateTitles }
      : {})
  }
  const messages = buildLlmFramingMessages(promptInput)

  trace('info', 'LLM Framing：已构造 messages', {
    outcome: input.outcome,
    factsKind: input.facts.kind
  })

  const rawText = await input.complete(messages, { taskKind: 'framing_nlg' })
  trace('info', 'LLM Framing：completer 返回', {
    preview: rawText.slice(0, 120)
  })

  const rawJson = parseJsonObjectFromLlmText(rawText)
  const proposal = LlmFollowUpProposalSchema.parse(rawJson)
  const gatedProposal =
    input.outcome === 'need_a_clue' ? proposal : { ...proposal, chips: [] as typeof proposal.chips }

  const mapped = mapLlmFollowUpProposal(gatedProposal, {
    parsed: input.parsed,
    outcome: 'need_a_clue'
  })
  if (!mapped) {
    trace('warn', 'LLM Framing：门禁拒收提议', {
      replyPreview: proposal.reply.slice(0, 80)
    })
    throw new Error('framing_nlg_gate_rejected')
  }

  trace('info', 'LLM Framing：门禁通过', {
    suggestionCount: mapped.suggestions.length
  })
  return mapped
}
