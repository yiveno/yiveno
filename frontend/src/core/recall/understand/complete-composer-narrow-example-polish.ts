/**
 * LLM 润色已选定的 Narrow 举例词：LLM prompt → completer → JSON → Zod → 门禁。
 * 失败抛错由上层捕获后回退选定原词；不碰数据平面。
 */

import {
  buildNarrowExampleCandidateCorpusLower,
  gatePolishedComposerNarrowExamples
} from '@/core/recall/gate-polished-composer-narrow-examples'
import {
  buildLlmNarrowExamplePolishMessages,
  type BuildLlmNarrowExamplePolishPromptInput
} from '@/core/recall/understand/build-llm-narrow-example-polish-prompt'
import type { ClueFlowTrace } from '@/core/recall/understand/clue-flow-trace'
import { noopClueFlowTrace } from '@/core/recall/understand/clue-flow-trace'
import { parseJsonObjectFromLlmText } from '@/core/recall/understand/extract-llm-json'
import { LlmNarrowExamplePolishProposalSchema } from '@/core/recall/understand/llm-narrow-example-polish-proposal'
import type { LlmChatCompleter } from '@/core/recall/understand/parse-recall-clue-with-llm'

export type CompleteComposerNarrowExamplePolishInput = {
  selectedExamples: readonly string[]
  candidateTextPreviews?: readonly string[]
  /** 门禁语料；缺省时用 candidateTextPreviews 拼接 */
  candidateCorpusTexts?: readonly string[]
  complete: LlmChatCompleter
  trace?: ClueFlowTrace
}

/**
 * 成功返回门禁后的展示串（与 selected 等长语义；可能部分位回退）。
 * Zod/解析失败抛错。
 */
export async function completeComposerNarrowExamplePolishWithLlm(
  input: CompleteComposerNarrowExamplePolishInput
): Promise<string[]> {
  const selected = input.selectedExamples.map(s => s.trim()).filter(Boolean)
  if (selected.length === 0) {
    return []
  }

  const trace = input.trace ?? noopClueFlowTrace
  const promptInput: BuildLlmNarrowExamplePolishPromptInput = {
    selectedExamples: selected,
    ...(input.candidateTextPreviews !== undefined
      ? { candidateTextPreviews: input.candidateTextPreviews }
      : {})
  }
  const messages = buildLlmNarrowExamplePolishMessages(promptInput)

  trace('info', 'LLM 举例润色：已构造 messages', {
    selectedCount: selected.length
  })

  const rawText = await input.complete(messages)
  trace('info', 'LLM 举例润色：completer 返回', {
    preview: rawText.slice(0, 120)
  })

  const rawJson = parseJsonObjectFromLlmText(rawText)
  const proposal = LlmNarrowExamplePolishProposalSchema.parse(rawJson)
  const corpusTexts = input.candidateCorpusTexts ?? input.candidateTextPreviews ?? selected
  const gated = gatePolishedComposerNarrowExamples({
    selected,
    polished: proposal.examples,
    candidateCorpusLower: buildNarrowExampleCandidateCorpusLower(corpusTexts)
  })

  trace('info', 'LLM 举例润色：门禁完成', {
    selected,
    polished: proposal.examples,
    gated
  })
  return gated
}
