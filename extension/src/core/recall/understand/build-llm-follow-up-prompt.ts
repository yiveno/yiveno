/**
 * 构造 LLM 追问 NLG 的 chat messages（客户端拼 prompt，经 hosted/complete 同桶计费）。
 * 仅用于 need_a_clue：结合弱候选收窄，禁止缺槽问卷。
 */

import type { ParsedRecallClue } from '@/core/recall/parse-recall-clue-types'

export type BuildLlmFollowUpPromptInput = {
  /** 本轮用户原文 */
  clue: string
  /** 合并后解析 */
  parsed: ParsedRecallClue
  /** 弱候选标题预览（截断） */
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
    '- Context: outcome is need_a_clue — weak candidates are already shown. Your job is ONLY to help narrow among them.',
    '- reply: 1–2 short sentences in the SAME language as the user clue.',
    '- Ask at most ONE clarification that distinguishes the listed candidates (a unique word, site, note).',
    '- Never run a fixed questionnaire (time-of-day bank, or "article / poem / code / song?").',
    '- Never re-ask slots already present in parsed (especially objectTypes / timeRange) as a blank form.',
    '- Never offer preference profiling ("tell me what you like and I’ll remember").',
    '- chips: 0–5 only when weakCandidateTitles lists ≥2 candidates; each chip must differentiate them (present in some, not all).',
    '- Never meta chips ("I don\'t remember", "not sure", "maybe"). Prefer type / site / unique word grounded in titles.',
    '- label matches reply language; value MUST be stable English phrases the parser understands.',
    '- Never invent memory items, titles, URLs, or facts not in weakCandidateTitles / context.',
    '- No markdown, no code fences, no extra keys.'
  ].join('\n')
}

/** 用户提示：注入本轮约束与候选上下文。 */
export function buildLlmFollowUpUserPrompt(input: BuildLlmFollowUpPromptInput): string {
  const { parsed } = input
  return [
    `userClue: ${input.clue}`,
    `outcome: need_a_clue`,
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
