/**
 * 构造 LLM Recall Framing NLG 的 chat messages。
 * 输入仅 RecallFramingFacts + 规则基线；P6 计数由客户端 deterministic 拼接。
 */

import type { ParsedRecallClue } from '@/core/recall/parse-recall-clue-types'
import type { RecallFramingFacts } from '@/core/recall/recall-framing-facts'
import type { RecallOutcome } from '@/core/recall/recall-result'

export type BuildLlmFramingPromptInput = {
  clue: string
  parsed: ParsedRecallClue
  outcome: RecallOutcome
  facts: RecallFramingFacts
  /** 规则模板 P1–P5 基线（供模型对齐，不得偏离事实）。 */
  rulesBaseline: string
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

/** 系统提示：Framing 润色边界。 */
export function buildLlmFramingSystemPrompt(): string {
  return [
    'You rewrite Yiveno Recall neighborhood framing for the user (Chrome extension personal memory recovery).',
    'Yiveno shows real saved excerpts/bookmarks — not web search, not a life assistant.',
    '',
    'Return ONLY JSON:',
    '{ "reply": string, "chips": [ { "label": string, "value": string } ] }',
    '',
    'Rules:',
    '- Rewrite the provided framingFacts into 1–2 short sentences in the SAME language as userClue.',
    '- Cover: what we understood, why these candidates appear, cluster shape if any, confidence stance, and ONE honest clarification if ambiguity is present.',
    '- Use ONLY facts in framingFacts / rulesBaseline / weakCandidateTitles. Never invent titles, URLs, sites, or memory items.',
    '- timeLabel in framingFacts is an internal slug (e.g. few_months_ago). Never show snake_case to the user; say natural English (a few months ago, last week, …). Prefer the wording already in rulesBaseline.',
    '- Do NOT include match counts or "showing 1–5" — the app appends counts separately.',
    '- No preference profiling; no questionnaire; no markdown; no extra keys.',
    '- chips: 0–5 only when outcome is need_a_clue; empty array for top_pick. label matches reply language; value MUST be stable English phrases.'
  ].join('\n')
}

/** 用户提示：注入事实 JSON 与基线文案。 */
export function buildLlmFramingUserPrompt(input: BuildLlmFramingPromptInput): string {
  return [
    `userClue: ${input.clue}`,
    `outcome: ${input.outcome}`,
    `framingFacts: ${JSON.stringify(input.facts)}`,
    `rulesBaseline: ${input.rulesBaseline}`,
    `weakCandidateTitles: ${previewList(input.weakCandidateTitles)}`,
    '',
    'Write the framing JSON now.'
  ].join('\n')
}

export function buildLlmFramingMessages(
  input: BuildLlmFramingPromptInput
): Array<{ role: 'system' | 'user'; content: string }> {
  return [
    { role: 'system', content: buildLlmFramingSystemPrompt() },
    { role: 'user', content: buildLlmFramingUserPrompt(input) }
  ]
}
