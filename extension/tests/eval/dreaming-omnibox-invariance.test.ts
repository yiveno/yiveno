/**
 * Dreaming Phase 4 · Omnibox 不变性：注入 noteMatches 不得改变 Omnibox 结果。
 */

import { describe, expect, it } from 'vitest'

import { buildDreamingDn1NoteMatches, buildDreamingEvalCorpus } from './dreaming-eval-corpus'
import { OMNIBOX_EVAL_CASES } from './omnibox-eval-cases'
import { buildRecallEvalCorpus } from './recall-eval-corpus'
import { runOmniboxEval } from './run-omnibox-eval'
import type { NoteMatchSet } from '@/core/recall/note-match'
import type { RecallResult } from '@/core/recall/recall-result'

function candidateIdSet(result: RecallResult): string[] {
  const ids: string[] = []
  if (result.topPick) {
    ids.push(result.topPick.item.id)
  }
  for (const match of result.alsoPossible) {
    ids.push(match.item.id)
  }
  return [...ids].sort()
}

function top1Id(result: RecallResult): string | null {
  return result.topPick?.item.id ?? null
}

describe('dreaming-omnibox-invariance', () => {
  it('OMNIBOX_EVAL_CASES：注入非空 noteMatches 后每条 top1 与基线一致', async () => {
    const corpus = buildRecallEvalCorpus()
    const baseline = await runOmniboxEval(OMNIBOX_EVAL_CASES, corpus)

    // 非空集：用 Dreaming fixture 命题构造（与 Omnibox 主 corpus 条目 id 可不重叠；
    // 关键是集非空且会传入 recallByKeywordWithParsedClue，由 omnibox 档位忽略）。
    const dreamingCorpus = buildDreamingEvalCorpus()
    const noteMatches: NoteMatchSet = buildDreamingDn1NoteMatches(dreamingCorpus)
    expect(noteMatches.size).toBeGreaterThan(0)

    const withNotes = await runOmniboxEval(OMNIBOX_EVAL_CASES, corpus, { noteMatches })

    expect(withNotes.cases).toHaveLength(baseline.cases.length)
    for (let index = 0; index < baseline.cases.length; index += 1) {
      const base = baseline.cases[index]!
      const next = withNotes.cases[index]!
      expect(next.caseId).toBe(base.caseId)
      expect(top1Id(next.result)).toBe(top1Id(base.result))
    }
  })

  it('差分：两轮候选 id 集（topPick + alsoPossible）完全相等', async () => {
    const corpus = buildRecallEvalCorpus()
    const baseline = await runOmniboxEval(OMNIBOX_EVAL_CASES, corpus)
    const noteMatches = buildDreamingDn1NoteMatches(buildDreamingEvalCorpus())
    const withNotes = await runOmniboxEval(OMNIBOX_EVAL_CASES, corpus, { noteMatches })

    for (let index = 0; index < baseline.cases.length; index += 1) {
      expect(candidateIdSet(withNotes.cases[index]!.result)).toEqual(
        candidateIdSet(baseline.cases[index]!.result)
      )
    }
  })
})
