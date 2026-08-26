/**
 * 构造 Narrow 举例词润色的 chat messages。
 * 仅润色已选定 grounded 词面；禁止造词 / 换词。
 */

export type BuildLlmNarrowExamplePolishPromptInput = {
  /** 确定性抽取已选定的举例（顺序固定） */
  selectedExamples: readonly string[]
  /** 候选语料短预览（帮助选 casing / 空格形态） */
  candidateTextPreviews?: readonly string[]
}

function previewList(values: readonly string[] | undefined, limit = 6): string {
  if (!values || values.length === 0) {
    return '(none)'
  }
  return values
    .slice(0, limit)
    .map(value => value.trim().slice(0, 120))
    .filter(Boolean)
    .join(' | ')
}

/** 系统提示：润色边界与 JSON 契约。 */
export function buildLlmNarrowExamplePolishSystemPrompt(): string {
  return [
    'You polish short example words for Yiveno Recall composer placeholders.',
    "These words already came from the user's saved candidates. You may ONLY improve display form.",
    '',
    'Return ONLY a JSON object:',
    '{ "examples": string[] }',
    '',
    'Rules:',
    '- examples MUST have the SAME length and order as selectedExamples.',
    '- Each polished string MUST be the SAME token as the corresponding selected word:',
    '  same letters/digits after removing spaces, hyphens, and punctuation (case-insensitive).',
    '- Allowed changes: casing (MDN, JavaScript), optional spaces/hyphens that already appear in candidateTextPreviews.',
    '- Forbidden: inventing new words, synonyms, themes, extra tokens, or swapping to a different selected word.',
    '- Prefer American English display forms that appear in candidateTextPreviews when possible.',
    '- No markdown, no code fences, no extra keys.'
  ].join('\n')
}

/** 用户提示：注入已选定词与候选预览。 */
export function buildLlmNarrowExamplePolishUserPrompt(
  input: BuildLlmNarrowExamplePolishPromptInput
): string {
  return [
    `selectedExamples: ${JSON.stringify([...input.selectedExamples])}`,
    `candidateTextPreviews: ${previewList(input.candidateTextPreviews)}`,
    '',
    'Polish the selectedExamples into display forms now.'
  ].join('\n')
}

export function buildLlmNarrowExamplePolishMessages(
  input: BuildLlmNarrowExamplePolishPromptInput
): Array<{ role: 'system' | 'user'; content: string }> {
  return [
    { role: 'system', content: buildLlmNarrowExamplePolishSystemPrompt() },
    { role: 'user', content: buildLlmNarrowExamplePolishUserPrompt(input) }
  ]
}
