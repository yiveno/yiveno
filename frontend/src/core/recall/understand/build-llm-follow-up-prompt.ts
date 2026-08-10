/**
 * 构造 LLM 追问 NLG 的 chat messages（客户端拼 prompt，经 hosted/complete 同桶计费）。
 */

import type { RecallEmptyKind, RecallOutcome } from '@/core/recall/recall-result'
import type { ParsedRecallClue } from '@/core/recall/parse-recall-clue-types'

export type BuildLlmFollowUpPromptInput = {
  /** 本轮用户原文 */
  clue: string
  /** 合并后解析 */
  parsed: ParsedRecallClue
  outcome: Extract<RecallOutcome, 'need_a_clue' | 'no_match'>
  emptyKind?: RecallEmptyKind
  /** 是否已挂最近同类猜测（文案须硬标猜测，不得当答案） */
  hasRelatedGuess?: boolean
  /** 弱候选标题预览（仅 need_a_clue；截断） */
  weakCandidateTitles?: string[]
}

function previewList(values: string[] | undefined, limit = 3): string {
  if (!values || values.length === 0) {
    return '(none)'
  }
  return values
    .slice(0, limit)
    .map(value => value.trim())
    .filter(Boolean)
    .join(' | ')
}

/** 系统提示：追问边界与 JSON 契约。 */
export function buildLlmFollowUpSystemPrompt(): string {
  return [
    'You write the next assistant turn for Yiveno Recall (personal memory recovery in a Chrome extension).',
    'Yiveno finds traces the user saved (excerpts/bookmarks), not web search and not a life assistant.',
    '',
    'Return ONLY a JSON object:',
    '{ "reply": string, "chips": [ { "label": string, "value": string } ] }',
    '',
    'Rules:',
    '- reply: 1–2 short sentences in the SAME language as the user clue.',
    '- Talk only about the memory library / saved traces. Never claim what the user did or did not do in real life.',
    '- Do NOT imply the retrieval system failed. Empty under clear constraints is a valid honest answer.',
    '- Ask for at most ONE high information-gain clarification. Never run a fixed questionnaire like "article, poem, code, or song?".',
    '- Never re-ask slots already present in parsed (especially objectTypes / timeRange).',
    '- chips: 0–5 optional clickable refinements. label matches reply language; value MUST be stable English phrases the parser understands (e.g. "yesterday", "last week", "recently", "just saved", "opened recently", "from this site", "my note", "article", "video", "song").',
    '- If emptyKind is constrained_none: acknowledge nothing matched that time+type in the library; offer time-correction chips; if hasRelatedGuess, you may mention a labeled guess exists but must say it is a guess / not the answer.',
    '- If outcome is need_a_clue: you may briefly acknowledge weak candidates without inventing titles not listed.',
    '- Never invent memory items, titles, URLs, or facts not in the context.',
    '- No markdown, no code fences, no extra keys.'
  ].join('\n')
}

/** 用户提示：注入本轮约束上下文。 */
export function buildLlmFollowUpUserPrompt(input: BuildLlmFollowUpPromptInput): string {
  const { parsed } = input
  return [
    `userClue: ${input.clue}`,
    `outcome: ${input.outcome}`,
    `emptyKind: ${input.emptyKind ?? 'n/a'}`,
    `hasRelatedGuess: ${input.hasRelatedGuess === true ? 'yes' : 'no'}`,
    `timeLabel: ${parsed.timeRange?.label ?? 'null'}`,
    `objectTypes: ${(parsed.objectTypes ?? []).join(',') || 'null'}`,
    `contentTerms: ${parsed.contentTerms.join(', ') || '(none)'}`,
    `noteHint: ${parsed.noteHint ? 'true' : 'false'}`,
    `behaviorHints: ${(parsed.behaviorHints ?? []).join(',') || 'null'}`,
    `weakCandidateTitles: ${previewList(input.weakCandidateTitles)}`,
    '',
    'Write the next follow-up JSON now.'
  ].join('\n')
}

export function buildLlmFollowUpMessages(
  input: BuildLlmFollowUpPromptInput
): Array<{ role: 'system' | 'user'; content: string }> {
  return [
    { role: 'system', content: buildLlmFollowUpSystemPrompt() },
    { role: 'user', content: buildLlmFollowUpUserPrompt(input) }
  ]
}
