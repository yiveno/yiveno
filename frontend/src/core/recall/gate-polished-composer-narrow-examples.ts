/**
 * 门禁：LLM 润色后的 Narrow 举例须与已选定词同一 identity，且可在候选语料核验。
 * 失败位回退到选定原词；禁止造词进入 placeholder。
 */

/** 折叠为可比 identity：小写 + 去掉非字母数字。 */
export function foldNarrowExampleIdentity(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

export type GatePolishedComposerNarrowExamplesInput = {
  /** 确定性抽取结果（权威顺序） */
  selected: readonly string[]
  /** LLM 提议的展示串 */
  polished: readonly string[]
  /** 候选字段拼接后的小写语料（供子串核验） */
  candidateCorpusLower: string
}

/**
 * 按位门禁；长度不一致则整表回退 selected。
 */
export function gatePolishedComposerNarrowExamples(
  input: GatePolishedComposerNarrowExamplesInput
): string[] {
  const { selected, polished, candidateCorpusLower } = input
  if (selected.length === 0) {
    return []
  }
  if (polished.length !== selected.length) {
    return [...selected]
  }

  const out: string[] = []
  for (let i = 0; i < selected.length; i += 1) {
    const selectedWord = selected[i]!.trim()
    const polishedWord = (polished[i] ?? '').trim()
    if (!selectedWord) {
      continue
    }
    if (!polishedWord) {
      out.push(selectedWord)
      continue
    }

    const selectedFold = foldNarrowExampleIdentity(selectedWord)
    const polishedFold = foldNarrowExampleIdentity(polishedWord)
    if (!selectedFold || polishedFold !== selectedFold) {
      out.push(selectedWord)
      continue
    }

    const polishedLower = polishedWord.toLowerCase()
    const selectedLower = selectedWord.toLowerCase()
    // 仅大小写变化，或展示形态已出现在候选语料中
    if (polishedLower === selectedLower || candidateCorpusLower.includes(polishedLower)) {
      out.push(polishedWord)
    } else {
      out.push(selectedWord)
    }
  }
  return out
}

/** 从候选文本字段拼小写语料。 */
export function buildNarrowExampleCandidateCorpusLower(texts: readonly string[]): string {
  return texts
    .map(text => text.trim().toLowerCase())
    .filter(Boolean)
    .join('\n')
}
