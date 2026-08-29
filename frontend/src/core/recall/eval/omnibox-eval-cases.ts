import { RECALL_EVAL_IDS, type RecallEvalItemId } from '@/core/recall/eval/recall-eval-ids'
import type {
  RecallEvalCase,
  RecallEvalClueClass,
  RecallEvalExpectation
} from '@/core/recall/eval/recall-eval-cases'

/**
 * Omnibox 离线快跳轨 must 夹具（ADR-007）。
 * 仅具体锚点 + R0 负例；不含多轮 / need_a_clue / 逛一簇（属 Side Panel 契约）。
 */
export interface OmniboxEvalCase {
  id: string
  clue: string
  clueClass: RecallEvalClueClass
  expectation: RecallEvalExpectation
  /** 中文说明：为何 Omnibox 应过此 case */
  note: string
}

/** Omnibox must：规则 parse + 关键词 Filter；与 `run-omnibox-eval` 对齐。 */
export const OMNIBOX_EVAL_CASES: OmniboxEvalCase[] = [
  {
    id: 'omnibox-concrete-mv3',
    clue: 'Manifest V3',
    clueClass: 'concrete',
    expectation: { kind: 'top1', expectedId: RECALL_EVAL_IDS.chromeExtensionMv3 },
    note: '标题专有名词快跳'
  },
  {
    id: 'omnibox-concrete-i18n-token',
    clue: 'i18n:check',
    clueClass: 'concrete',
    expectation: { kind: 'top1', expectedId: RECALL_EVAL_IDS.deployChecklistExcerpt },
    note: '摘录独特 token'
  },
  {
    id: 'omnibox-concrete-github-path',
    clue: 'github.com/cqw',
    clueClass: 'concrete',
    expectation: { kind: 'top1', expectedId: RECALL_EVAL_IDS.githubRepo },
    note: '域名+路径'
  },
  {
    id: 'omnibox-concrete-rt-host',
    clue: 'rottentomatoes.com',
    clueClass: 'concrete',
    expectation: { kind: 'top1', expectedId: RECALL_EVAL_IDS.oppenheimerRtExcerpt },
    note: '纯 host 对齐摘录'
  },
  {
    id: 'omnibox-concrete-cloudflare',
    clue: 'Cloudflare Workers',
    clueClass: 'concrete',
    expectation: { kind: 'top1', expectedId: RECALL_EVAL_IDS.cloudflareWorkersGuide },
    note: '书签标题词面'
  },
  {
    id: 'omnibox-concrete-retention-title',
    clue: 'retention analysis',
    clueClass: 'concrete',
    expectation: { kind: 'top1', expectedId: RECALL_EVAL_IDS.retentionFramework },
    note: '标题关键词'
  },
  {
    id: 'omnibox-concrete-product-doc',
    clue: 'product doc',
    clueClass: 'concrete',
    expectation: { kind: 'top1', expectedId: RECALL_EVAL_IDS.yivenoProductDoc },
    note: '两篇 Yiveno 书签并存时靠更具体词'
  },
  {
    id: 'omnibox-concrete-empty-state',
    clue: 'empty-state tiers',
    clueClass: 'concrete',
    expectation: { kind: 'top1', expectedId: RECALL_EVAL_IDS.weeklyReviewNote },
    note: '摘录正文锚点'
  },
  {
    id: 'omnibox-semi-note-deploy',
    clue: 'page where I left a note about deploy',
    clueClass: 'semi_fuzzy',
    expectation: { kind: 'in_topk', expectedId: RECALL_EVAL_IDS.deployNoteExcerpt, k: 3 },
    note: '附注字面 deploy；规则层应进 top-3（无 LLM）'
  },
  {
    id: 'omnibox-negative-songs',
    clue: 'play some songs I like',
    clueClass: 'negative',
    expectation: { kind: 'no_match' },
    note: '零锚点口语 → 诚实空；引导 Side Panel'
  },
  {
    id: 'omnibox-negative-summarize',
    clue: 'summarize the latest news for me',
    clueClass: 'negative',
    expectation: { kind: 'no_match' },
    note: '助手摘要非找回'
  },
  {
    id: 'omnibox-negative-bored-pick',
    clue: 'i feel bored pick something fun for me',
    clueClass: 'negative',
    expectation: { kind: 'no_match' },
    note: '无聊发令非找回'
  }
]

/** 将 Omnibox case 转为 recall-eval runner 可复用的 gate=must 形态（单测 judge 复用）。 */
export function toRecallEvalMustCase(item: OmniboxEvalCase): RecallEvalCase {
  return {
    id: item.id,
    clue: item.clue,
    clueClass: item.clueClass,
    gate: 'must',
    expectation: item.expectation,
    note: item.note
  }
}

/** 断言用：期望命中的 corpus id 全集（防 case 写错 id）。 */
export const OMNIBOX_EVAL_EXPECTED_IDS: RecallEvalItemId[] = OMNIBOX_EVAL_CASES.flatMap(item => {
  const { expectation } = item
  if (expectation.kind === 'no_match') {
    return []
  }
  return [expectation.expectedId]
})
