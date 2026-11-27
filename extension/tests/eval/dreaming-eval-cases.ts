/**
 * Dreaming Phase 4 · 命题命中 must 用例数据（D-N1–D-N6）。
 * expectation 形态对齐 RecallEvalExpectation；expectedId 为 Dreaming 专用 UUID。
 */

import { DREAMING_EVAL_IDS } from './dreaming-eval-corpus'
import type { RecallEvalCase } from './recall-eval-cases'
import type { RecallEvalItemId } from './recall-eval-ids'

/** 把 Dreaming 条目 id 断言进 RecallEval 期望槽（judge 只比字符串）。 */
function asEvalId(id: string): RecallEvalItemId {
  return id as RecallEvalItemId
}

/**
 * 走 `runRecallEval` 的用例（D-N1 / D-N3）。
 * 其余 case 在测试里直接调 recallByKeywordWithParsedClue / recallWithClue。
 */
export const DREAMING_NOTE_EVAL_CASES: RecallEvalCase[] = [
  {
    id: 'dreaming-dn1-note-top1',
    clue: 'rottnest quokka',
    clueClass: 'concrete',
    gate: 'must',
    expectation: {
      kind: 'top1',
      expectedId: asEvalId(DREAMING_EVAL_IDS.dreamingRottnestExcerpt)
    },
    note: 'D-N1：原文无线索词字面；命题双 term 命中 → Top1 且 score 24'
  },
  {
    id: 'dreaming-dn3-no-double-count',
    clue: 'rottnest ferry',
    clueClass: 'concrete',
    gate: 'must',
    expectation: {
      kind: 'top1',
      expectedId: asEvalId(DREAMING_EVAL_IDS.dreamingRottnestBookmark)
    },
    note: 'D-N3：同源 3 命题 + 字面并存；折叠后只计 1 组，出处取最优 2 词命题'
  },
  {
    id: 'dreaming-dn2-bigram-not-top1',
    clue: 'rottnest island',
    clueClass: 'semi_fuzzy',
    gate: 'must',
    expectation: {
      kind: 'need_a_clue',
      expectedId: asEvalId(DREAMING_EVAL_IDS.dreamingRottnestExcerpt)
    },
    note: 'D-N2：单 bigram 命题分 10 < Top Pick 门槛 → need_a_clue'
  },
  {
    id: 'dreaming-dn4-missing-topic',
    clue: 'A word that was learned before',
    clueClass: 'negative',
    gate: 'must',
    expectation: { kind: 'no_match', emptyKind: 'missing_topic' },
    note: 'D-N4：无主题锚；命题不得绕过 Topic 门（未进 listForKeywordRecall）'
  },
  {
    id: 'dreaming-dn5-exclude-hard-cut',
    clue: 'quokka habitat',
    clueClass: 'concrete',
    gate: 'must',
    expectation: { kind: 'no_match' },
    note: 'D-N5：命题命中但源含 exclude 词 settlement → 硬切'
  },
  {
    id: 'dreaming-dn6-dirty-orphan',
    clue: 'aurora borealis',
    clueClass: 'concrete',
    gate: 'must',
    expectation: { kind: 'no_match' },
    note: 'D-N6：脏命题 / 孤儿命题不进 NoteMatchSet'
  }
]
