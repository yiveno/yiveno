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
  /** 模拟用户提交的 clue（单轮；多轮时等于 dialogTurns 最后一句） */
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
    gate: 'must',
    expectation: { kind: 'in_topk', expectedId: RECALL_EVAL_IDS.excerptMatchPrefixTightEn, k: 3 },
    note: '英文同样：起首+更短密优先于夹心长句（语料须与中文探针正文分离，避免折叠吞项）'
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
    id: 'r0-zero-anchor-bored-pick',
    clue: 'i feel bored pick something fun for me',
    clueClass: 'negative',
    gate: 'must',
    expectation: { kind: 'no_match' },
    note: 'R0：无聊助手发令 → 诚实空，禁扫库编造'
  },
  {
    id: 'r0-zero-anchor-recommend-movie',
    clue: 'recommend a good movie I should watch tonight',
    clueClass: 'negative',
    gate: 'must',
    expectation: { kind: 'no_match' },
    note: 'R0：推荐电影 ≠ 找回；有 video 类型词也不得当娱乐推荐'
  },
  {
    id: 'r0-non-recall-weather',
    clue: 'what is the weather going to be like tomorrow',
    clueClass: 'negative',
    gate: 'must',
    expectation: { kind: 'no_match' },
    note: 'R0：天气问答非找回；禁扫库沾边'
  },
  {
    id: 'r0-non-recall-order-food',
    clue: 'order me some pizza for dinner',
    clueClass: 'negative',
    gate: 'must',
    expectation: { kind: 'no_match' },
    note: 'R0：点餐非找回；禁扫烹饪噪声'
  },
  {
    id: 'r0-non-recall-summarize',
    clue: 'summarize the latest news for me',
    clueClass: 'negative',
    gate: 'must',
    expectation: { kind: 'no_match' },
    note: 'R0：摘要助手非找回；禁扫 news/diversity 噪声'
  },
  {
    id: 'r0-non-recall-plan-trip',
    clue: 'plan a weekend trip to seattle for me',
    clueClass: 'negative',
    gate: 'must',
    expectation: { kind: 'no_match' },
    note: 'R0：行程规划非找回；禁扫 weekend/hiking 噪声'
  },
  {
    id: 'r0-non-recall-codegen',
    clue: 'write a python script that renames my files',
    clueClass: 'negative',
    gate: 'must',
    expectation: { kind: 'no_match' },
    note: 'R0：写码助手非找回；禁扫 MDN/script 词面'
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
    note: 'Type B：正文泛化，靠个人附注 clues.note 找回'
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
    note: 'R0/B：T1 附注锚点 + T2 只补 yesterday；槽位 merge 后仍应 Top1 命中附注项'
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
  {
    id: 'concrete-gregory-peck-million-pound',
    clue: 'Gregory Peck million pound note 1954',
    clueClass: 'concrete',
    gate: 'must',
    expectation: { kind: 'top1', expectedId: RECALL_EVAL_IDS.millionPoundPeckExcerpt },
    note: '英文摘录含 Peck / Million Pound / 1954 时应稳定 Top1（非 no_match）'
  },
  {
    id: 'semi-fuzzy-note-inflection-over-shared-word',
    clue: 'newsletter where I disagreed with section 3',
    clueClass: 'semi_fuzzy',
    gate: 'must',
    expectation: { kind: 'top1', expectedId: RECALL_EVAL_IDS.noteAnchorDisagreeSection },
    note: '屈折 disagreed→disagree + note 多词覆盖；须压过仅共享 newsletter 的对手摘录'
  },
  {
    id: 'semi-fuzzy-weak-title-note-anchor',
    clue: 'the untitled doc where I noted NSF grant narrative',
    clueClass: 'semi_fuzzy',
    gate: 'must',
    expectation: { kind: 'top1', expectedId: RECALL_EVAL_IDS.weakTitleNoteGrant },
    note: '弱标题 Untitled，靠 clues.note（grant narrative）钉死 Top1'
  },
  {
    id: 'semi-fuzzy-few-days-ago-privacy',
    clue: 'the privacy article from a few days ago',
    clueClass: 'semi_fuzzy',
    gate: 'must',
    expectation: { kind: 'top1', expectedId: RECALL_EVAL_IDS.recentPrivacyArticle },
    note: 'a few days ago→recent（含近 3 天）；勿误入 a_while_ago 硬排除'
  },
  {
    id: 'semi-fuzzy-old-adjective-dense-passage',
    clue: 'that old DPR paper on arxiv',
    clueClass: 'semi_fuzzy',
    gate: 'must',
    expectation: { kind: 'top1', expectedId: RECALL_EVAL_IDS.oldDensePassagePaper },
    note: 'soft old 不作时间硬窗；靠 DPR/arxiv 内容锚 Top1'
  },

  // —— must：§5.11.2 R4 新增（Normative id） ——
  {
    id: 'r4-semi-fuzzy-time-excerpt',
    clue: "article I didn't finish last week",
    clueClass: 'semi_fuzzy',
    gate: 'must',
    expectation: { kind: 'in_topk', expectedId: RECALL_EVAL_IDS.halfReadArticleExcerpt, k: 3 },
    note: 'R4：half_read + last_week · 钉死未读完摘录'
  },
  {
    id: 'r4-semi-fuzzy-note-anchor',
    clue: 'page where I left a note about deploy',
    clueClass: 'semi_fuzzy',
    gate: 'must',
    expectation: { kind: 'in_topk', expectedId: RECALL_EVAL_IDS.deployNoteExcerpt, k: 3 },
    note: 'R4：附注指向 deploy checklist reminder'
  },
  {
    id: 'r4-vague-recently-saved',
    clue: 'just saved something about i18n',
    clueClass: 'vague',
    gate: 'must',
    expectation: { kind: 'in_topk', expectedId: RECALL_EVAL_IDS.recentI18nExcerpt, k: 3 },
    note: 'R4：recently_saved 邻域 · 近因 i18n 摘录'
  },
  {
    id: 'r4-vague-often-opened',
    clue: 'the Yiveno page I kept opening',
    clueClass: 'vague',
    gate: 'must',
    expectation: { kind: 'top1', expectedId: RECALL_EVAL_IDS.yivenoDesignPrinciples },
    note: 'R4：often_opened · 高 settledCount 设计原则页应 Top1（非仅进邻域）'
  },
  {
    id: 'r4-cluster-yiveno-docs-product',
    clue: 'Yiveno docs I saved',
    clueClass: 'semi_fuzzy',
    gate: 'must',
    expectation: { kind: 'in_topk', expectedId: RECALL_EVAL_IDS.yivenoProductDoc, k: 6 },
    note: 'R4 逛一簇：同 clue 须含产品文档（与 design 拆两条）'
  },
  {
    id: 'r4-cluster-yiveno-docs-design',
    clue: 'Yiveno docs I saved',
    clueClass: 'semi_fuzzy',
    gate: 'must',
    expectation: { kind: 'in_topk', expectedId: RECALL_EVAL_IDS.yivenoDesignPrinciples, k: 6 },
    note: 'R4 逛一簇：同 clue 须含设计原则（与 product 拆两条）'
  },
  {
    id: 'r4-negative-zero-anchor',
    clue: 'play some songs I like',
    clueClass: 'negative',
    gate: 'must',
    expectation: { kind: 'no_match' },
    note: 'R4/Normative id：与 r0-zero-anchor-assistant-command 同线索 · 零锚点禁助手路径'
  },
  {
    id: 'r4-constrained-time-empty',
    clue: 'poem I saved yesterday',
    clueClass: 'semi_fuzzy',
    gate: 'must',
    expectation: { kind: 'no_match' },
    note: 'R4：poem + yesterday 强约束库空 → 诚实 no_match'
  },

  // —— stretch：仍需同义/语义层 ——
  {
    id: 'stretch-synonym-recall',
    clue: 'what happens after semantic recall',
    clueClass: 'semi_fuzzy',
    gate: 'stretch',
    expectation: { kind: 'in_topk', expectedId: RECALL_EVAL_IDS.vectorIndexExcerpt, k: 3 },
    note: '意图接近「embedding Phase B」，词面重叠极弱；留给 Hybrid'
  },
  {
    id: 'stretch-atomic-bomb-movie-review',
    clue: 'the atomic bomb movie review I saved',
    clueClass: 'semi_fuzzy',
    gate: 'stretch',
    expectation: { kind: 'in_topk', expectedId: RECALL_EVAL_IDS.oppenheimerRtExcerpt, k: 3 },
    note: '词面几乎无重叠；须 Hybrid 全库语义近邻（关键词池为空仍可融合）'
  }
]
