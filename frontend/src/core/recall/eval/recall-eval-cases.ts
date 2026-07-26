import { RECALL_EVAL_IDS, type RecallEvalItemId } from '@/core/recall/eval/recall-eval-ids'

/** 线索画像档位：具体 / 半模糊 / 很糊 / 负例。 */
export type RecallEvalClueClass = 'concrete' | 'semi_fuzzy' | 'vague' | 'negative'

/**
 * 期望形态。
 * - top1：Top Pick 必须是 expectedId
 * - in_topk：期望项须出现在候选前 k（含 Top Pick）
 * - no_match：应无 Top Pick
 */
export type RecallEvalExpectation =
  | { kind: 'top1'; expectedId: RecallEvalItemId }
  | { kind: 'in_topk'; expectedId: RecallEvalItemId; k?: number }
  | { kind: 'no_match' }

/**
 * 门禁级别。
 * - must：CI 必须通过（当前 Filter 基线能力）
 * - stretch：已知难点；汇报但不挡门禁，供后续优化对齐
 */
export type RecallEvalGate = 'must' | 'stretch'

export interface RecallEvalCase {
  id: string
  /** 模拟用户输入的线索 */
  clue: string
  clueClass: RecallEvalClueClass
  gate: RecallEvalGate
  expectation: RecallEvalExpectation
  /** 中文说明：为何这样出题 */
  note: string
}

/** Eval 线索集：固定出题，改 Filter 后用同一尺子量。 */
export const RECALL_EVAL_CASES: RecallEvalCase[] = [
  // —— must：具体锚点 ——
  {
    id: 'concrete-domain-github',
    clue: 'github.com/cqw',
    clueClass: 'concrete',
    gate: 'must',
    expectation: { kind: 'top1', expectedId: RECALL_EVAL_IDS.githubRepo },
    note: '域名+路径片段应直接定位仓库书签'
  },
  {
    id: 'concrete-title-retention',
    clue: '留存分析',
    clueClass: 'concrete',
    gate: 'must',
    expectation: { kind: 'top1', expectedId: RECALL_EVAL_IDS.retentionFramework },
    note: '标题关键词应 Top Pick'
  },
  {
    id: 'concrete-excerpt-deploy',
    clue: 'env:sync:prod',
    clueClass: 'concrete',
    gate: 'must',
    expectation: { kind: 'top1', expectedId: RECALL_EVAL_IDS.deployChecklistExcerpt },
    note: '摘录中的独特 token 应命中'
  },
  {
    id: 'concrete-cloudflare-workers',
    clue: 'Cloudflare Workers',
    clueClass: 'concrete',
    gate: 'must',
    expectation: { kind: 'top1', expectedId: RECALL_EVAL_IDS.cloudflareWorkersGuide },
    note: '专有名词标题命中'
  },
  {
    id: 'concrete-mv3',
    clue: 'Manifest V3',
    clueClass: 'concrete',
    gate: 'must',
    expectation: { kind: 'top1', expectedId: RECALL_EVAL_IDS.chromeExtensionMv3 },
    note: '英文专有名词'
  },
  {
    id: 'concrete-yiveno-docs-among-siblings',
    clue: '产品文档',
    clueClass: 'concrete',
    gate: 'must',
    expectation: { kind: 'top1', expectedId: RECALL_EVAL_IDS.yivenoProductDoc },
    note: '两篇 Yiveno 书签并存时，应用更具体词区分'
  },
  {
    id: 'behavior-prefer-frequently-opened',
    clue: 'Yiveno',
    clueClass: 'concrete',
    gate: 'must',
    expectation: { kind: 'top1', expectedId: RECALL_EVAL_IDS.yivenoDesignPrinciples },
    note: '词面相近时，高 openCount + 近因应压过较新但未打开的产品文档'
  },
  {
    id: 'concrete-excerpt-weekly',
    clue: '空状态分层',
    clueClass: 'concrete',
    gate: 'must',
    expectation: { kind: 'top1', expectedId: RECALL_EVAL_IDS.weeklyReviewNote },
    note: '摘录正文短语'
  },

  {
    id: 'primary-over-context-match',
    clue: '红白',
    clueClass: 'concrete',
    gate: 'must',
    expectation: { kind: 'top1', expectedId: RECALL_EVAL_IDS.excerptMatchPrefixTight },
    note: '主文起首+短密应压过夹心匹配与仅上下文（语言无关贴合度）'
  },
  {
    id: 'match-quality-prefix-density-zh',
    clue: '红白',
    clueClass: 'concrete',
    gate: 'must',
    expectation: { kind: 'in_topk', expectedId: RECALL_EVAL_IDS.excerptMatchEmbedded, k: 3 },
    note: '夹心匹配仍应可召回，但不得抢 Top1'
  },
  {
    id: 'match-quality-prefix-density-en',
    clue: 'red white',
    clueClass: 'concrete',
    gate: 'must',
    expectation: { kind: 'top1', expectedId: RECALL_EVAL_IDS.excerptMatchPrefixTightEn },
    note: '英文同样：起首+更短密优先于夹心长句'
  },

  // —— must：半模糊但仍有共享子串 ——
  {
    id: 'semi-fuzzy-deploy-checklist',
    clue: '上线检查',
    clueClass: 'semi_fuzzy',
    gate: 'must',
    expectation: { kind: 'in_topk', expectedId: RECALL_EVAL_IDS.deployChecklistExcerpt, k: 3 },
    note: '页名相关词，允许不进 Top1 但须进前三'
  },
  {
    id: 'semi-fuzzy-vector-filter',
    clue: '关键词 Filter',
    clueClass: 'semi_fuzzy',
    gate: 'must',
    expectation: { kind: 'top1', expectedId: RECALL_EVAL_IDS.vectorIndexExcerpt },
    note: '摘录内术语'
  },

  // —— must：负例 ——
  {
    id: 'negative-unrelated',
    clue: '完全无关的量子物理',
    clueClass: 'negative',
    gate: 'must',
    expectation: { kind: 'no_match' },
    note: '库中无相关项时应 no_match'
  },
  {
    id: 'negative-too-generic-noise',
    clue: '红烧肉',
    clueClass: 'negative',
    gate: 'must',
    expectation: { kind: 'top1', expectedId: RECALL_EVAL_IDS.cookingRecipeNoise },
    note: '噪声项存在时，具体菜名仍应命中自身（防误伤）'
  },

  {
    id: 'semi-fuzzy-deploy-paraphrase',
    clue: '发版前要跑哪些检查',
    clueClass: 'semi_fuzzy',
    gate: 'must',
    expectation: { kind: 'in_topk', expectedId: RECALL_EVAL_IDS.deployChecklistExcerpt, k: 3 },
    note: '同义改写：靠中文 bigram「检查」等拉回清单摘录'
  },
  {
    id: 'concrete-typo-yiveno-doc',
    clue: 'Yiveno产品文挡',
    clueClass: 'concrete',
    gate: 'must',
    expectation: { kind: 'top1', expectedId: RECALL_EVAL_IDS.yivenoProductDoc },
    note: '去空白 + 条件编辑距离，容忍「文挡」错别字'
  },
  {
    id: 'negative-too-short',
    clue: 'a',
    clueClass: 'negative',
    gate: 'must',
    expectation: { kind: 'no_match' },
    note: 'ASCII 单字母过噪不召回；汉字单字允许（见 tokenize / keyword-filter）'
  },

  // —— stretch：仍需同义/语义层 ——
  {
    id: 'stretch-synonym-recall',
    clue: '语义召回以后怎么做',
    clueClass: 'semi_fuzzy',
    gate: 'stretch',
    expectation: { kind: 'in_topk', expectedId: RECALL_EVAL_IDS.vectorIndexExcerpt, k: 3 },
    note: '意图接近「embedding Phase B」，词面重叠极弱；留给 Hybrid'
  }
]
