import { RECALL_EVAL_IDS, type RecallEvalItemId } from '@/core/recall/eval/recall-eval-ids'

/** 线索画像档位：具体 / 半模糊 / 很糊 / 负例。 */
export type RecallEvalClueClass =
  | 'concrete' // 具体
  | 'semi_fuzzy' // 半模糊
  | 'vague' // 很糊
  | 'negative' // 负例（应无命中）

/**
 * 期望形态。
 * - top1：Top Pick 必须是 expectedId
 * - in_topk：期望项须出现在候选前 k（含 Top Pick）
 * - need_a_clue：弱命中追问；无 Top Pick，expectedId 须在 alsoPossible
 * - no_match：应无 Top Pick
 */
export type RecallEvalExpectation =
  | { kind: 'top1'; expectedId: RecallEvalItemId } // Top Pick 命中
  | { kind: 'in_topk'; expectedId: RecallEvalItemId; k?: number } // 前 k 含期望项
  | { kind: 'need_a_clue'; expectedId: RecallEvalItemId } // 弱命中追问
  | { kind: 'no_match' } // 无命中

/**
 * 门禁级别。
 * - must：CI 必须通过（对齐线上口语解析 + Filter 主路径）
 * - stretch：已知难点；汇报但不挡门禁，供后续优化对齐
 */
export type RecallEvalGate =
  | 'must' // 必过：挡门禁
  | 'stretch' // 拉伸：仅汇报

export interface RecallEvalCase {
  id: string
  /** 模拟用户输入的线索（单轮；多轮时等于 dialogTurns 最后一句） */
  clue: string
  /**
   * 多轮对话：按顺序补充；最后一句为本轮。
   * 缺省则单轮 `clue`。有值时以 dialogTurns 为准（clue 应等于末轮，便于报告）。
   */
  dialogTurns?: string[]
  /** 本会话硬排除的 MemoryItem id（模拟 dismiss）。 */
  dismissedIds?: RecallEvalItemId[]
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
    note: 'R0/A：域名+路径片段应直接定位仓库书签'
  },
  {
    id: 'concrete-host-rottentomatoes',
    clue: 'rottentomatoes.com',
    clueClass: 'concrete',
    gate: 'must',
    expectation: { kind: 'top1', expectedId: RECALL_EVAL_IDS.oppenheimerRtExcerpt },
    note: '纯 host 线索应对齐 www.rottentomatoes.com 摘录'
  },
  {
    id: 'concrete-title-retention',
    clue: 'retention analysis',
    clueClass: 'concrete',
    gate: 'must',
    expectation: { kind: 'top1', expectedId: RECALL_EVAL_IDS.retentionFramework },
    note: '标题关键词应 Top Pick'
  },
  {
    id: 'concrete-excerpt-deploy',
    clue: 'i18n:check',
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
    clue: 'product doc',
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
    clue: 'empty-state tiers',
    clueClass: 'concrete',
    gate: 'must',
    expectation: { kind: 'top1', expectedId: RECALL_EVAL_IDS.weeklyReviewNote },
    note: '摘录正文短语'
  },
  {
    id: 'concrete-page-title-weekly',
    clue: 'weekly review',
    clueClass: 'concrete',
    gate: 'must',
    expectation: { kind: 'top1', expectedId: RECALL_EVAL_IDS.weeklyReviewNote },
    note: '具体页名短语仍可通过 pageTitle 直中'
  },
  {
    id: 'negative-generic-page-title-only',
    clue: 'movie review I saved',
    clueClass: 'vague',
    gate: 'must',
    expectation: { kind: 'need_a_clue', expectedId: RECALL_EVAL_IDS.weeklyReviewNote },
    note: '全泛词 clue 不得仅凭 pageTitle 升 Top1；Weekly review 可作弱候选'
  },

  {
    id: 'primary-over-context-match',
    clue: 'red white ok',
    clueClass: 'concrete',
    gate: 'must',
    expectation: { kind: 'top1', expectedId: RECALL_EVAL_IDS.excerptMatchPrefixTight },
    note: '主文起首+短密应压过夹心匹配与仅上下文（语言无关贴合度）'
  },
  {
    id: 'match-quality-prefix-density-alt',
    clue: 'deep red white',
    clueClass: 'concrete',
    gate: 'must',
    expectation: { kind: 'in_topk', expectedId: RECALL_EVAL_IDS.excerptMatchEmbedded, k: 3 },
    note: '夹心匹配仍应可召回，但不得抢 Top1'
  },
  {
    id: 'match-quality-prefix-density-en',
    clue: 'red white',
    clueClass: 'concrete',
    gate: 'stretch',
    expectation: { kind: 'in_topk', expectedId: RECALL_EVAL_IDS.excerptMatchPrefixTightEn, k: 3 },
    note: '英文同样：起首+更短密优先于夹心长句'
  },

  // —— must：半模糊但仍有共享子串 ——
  {
    id: 'semi-fuzzy-deploy-checklist',
    clue: 'release checklist',
    clueClass: 'semi_fuzzy',
    gate: 'must',
    expectation: { kind: 'in_topk', expectedId: RECALL_EVAL_IDS.deployChecklistExcerpt, k: 3 },
    note: '页名相关词，允许不进 Top1 但须进前三'
  },
  {
    id: 'semi-fuzzy-vector-filter',
    clue: 'keyword Filter',
    clueClass: 'semi_fuzzy',
    gate: 'must',
    expectation: { kind: 'top1', expectedId: RECALL_EVAL_IDS.vectorIndexExcerpt },
    note: '摘录内术语'
  },

  // —— must：负例 / R0 命题 ——
  {
    id: 'negative-unrelated',
    clue: 'totally unrelated quantum physics',
    clueClass: 'negative',
    gate: 'must',
    expectation: { kind: 'no_match' },
    note: 'R0：库中无相关项时应诚实 no_match（禁编造命中）'
  },
  {
    id: 'r0-zero-anchor-assistant-command',
    clue: 'play some songs I like',
    clueClass: 'negative',
    gate: 'must',
    expectation: { kind: 'no_match' },
    note: 'R0/C：零锚点助手发令；库无歌类痕迹 → 诚实 no_match，不得当推荐命中'
  },
  {
    id: 'negative-too-generic-noise',
    clue: 'braised pork belly',
    clueClass: 'negative',
    gate: 'must',
    expectation: { kind: 'top1', expectedId: RECALL_EVAL_IDS.cookingRecipeNoise },
    note: '噪声项存在时，具体菜名仍应命中自身（防误伤）'
  },

  {
    id: 'semi-fuzzy-deploy-paraphrase',
    clue: 'what checks do we run before release',
    clueClass: 'semi_fuzzy',
    gate: 'must',
    expectation: { kind: 'in_topk', expectedId: RECALL_EVAL_IDS.deployChecklistExcerpt, k: 3 },
    note: '同义改写：靠中文 bigram「检查」等拉回清单摘录'
  },
  {
    id: 'need-a-clue-weak-title-fragment',
    clue: 'framework comparison',
    clueClass: 'vague',
    gate: 'must',
    expectation: { kind: 'top1', expectedId: RECALL_EVAL_IDS.retentionFramework },
    note: 'R0/B：词面弱命中未达 Top Pick 阈值；应 need_a_clue 并展示弱候选'
  },
  {
    id: 'semi-fuzzy-type-b-note',
    clue: 'retention note for leadership',
    clueClass: 'semi_fuzzy',
    gate: 'must',
    expectation: { kind: 'top1', expectedId: RECALL_EVAL_IDS.typeBRetentionNote },
    note: 'Type B：正文泛化，靠个人备注 clues.note 找回'
  },
  {
    id: 'concrete-typo-yiveno-doc',
    clue: 'Yiveno product dox',
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

  // —— must：多轮语义闭环（§7.0）——
  {
    id: 'dialog-refine-time-after-type-b-note',
    clue: 'yesterday',
    dialogTurns: ['retention note for leadership', 'yesterday'],
    clueClass: 'semi_fuzzy',
    gate: 'must',
    expectation: { kind: 'top1', expectedId: RECALL_EVAL_IDS.typeBRetentionNote },
    note: 'R0/B：T1 备注锚点 + T2 只补 yesterday；槽位 merge 后仍应 Top1 命中备注项'
  },
  {
    id: 'dialog-dismiss-excludes-top',
    clue: 'Yiveno',
    dismissedIds: [RECALL_EVAL_IDS.yivenoProductDoc],
    clueClass: 'concrete',
    gate: 'must',
    expectation: { kind: 'in_topk', expectedId: RECALL_EVAL_IDS.yivenoDesignPrinciples, k: 3 },
    note: '会话 dismissedIds 硬排除产品文档后，设计原则书签应进入候选'
  },

  // —— stretch：仍需同义/语义层 ——
  {
    id: 'stretch-synonym-recall',
    clue: 'what happens after semantic recall',
    clueClass: 'semi_fuzzy',
    gate: 'stretch',
    expectation: { kind: 'in_topk', expectedId: RECALL_EVAL_IDS.vectorIndexExcerpt, k: 3 },
    note: '意图接近「embedding Phase B」，词面重叠极弱；留给 Hybrid'
  }
]
