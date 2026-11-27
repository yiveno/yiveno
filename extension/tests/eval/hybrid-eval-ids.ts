/**
 * Hybrid eval 记忆库稳定 ID。
 *
 * 与 `RECALL_EVAL_IDS`（`1111...`）命名空间独立；Hybrid eval corpus 全部用 `2222...` 前缀，
 * 避免与现有关键词 eval、TTE gold 之间在断言时混淆。
 *
 * 新增 Hybrid 项须追加在此处；`run-hybrid-eval` 通过这些 ID 断言期望命中。
 */

export const HYBRID_EVAL_IDS = {
  /** 语义近邻目标：英文，同义改写通过向量同向命中 */
  semanticNearNeighborExcerpt: '22222222-2222-4222-8222-222222222201',
  /** 词面保护场景：keyword Top1 关键词池强势，Hybrid 不得把它挤出首位 */
  keywordLeaderPage: '22222222-2222-4222-8222-222222222202',
  /** 关键词压不住的「纯语义近邻」——词面完全无重叠 */
  pureSemanticMovieNote: '22222222-2222-4222-8222-222222222203',
  /** 时窗内真正候选（high 硬筛应留下） */
  inWindowRecentExcerpt: '22222222-2222-4222-8222-222222222204',
  /** 时窗外无关条目（high 硬筛应剔除） */
  outOfWindowOldExcerpt: '22222222-2222-4222-8222-222222222205',
  /** 窗内但与 clue 准正交（佐证门应剔除，仅语义命中不行） */
  inWindowUnrelatedExcerpt: '22222222-2222-4222-8222-222222222206',
  /** currentTabDomain 同域加成目标 */
  sameDomainArticle: '22222222-2222-4222-8222-222222222207',
  /** currentTabDomain 之外、但与 clue 语义近邻；与 sameDomainArticle 抢 Top1 */
  offDomainNearNeighbor: '22222222-2222-4222-8222-222222222208',
  /** R0 must：零锚点助手发令，Hybrid 不得用语义近邻填空 */
  r0AssistantCommand: '22222222-2222-4222-8222-222222222209',
  /** R0 must：非 Recall 生活助手意图，语义命中也不得交卷 */
  r0NonRecallWeather: '22222222-2222-4222-8222-222222222210',
  /** 窗外专有内容锚：high 硬筛空佐证后 soft 回退须捞回（窗内仅噪音） */
  softReopenXenonRetention: '22222222-2222-4222-8222-222222222211'
} as const

export type HybridEvalItemId = (typeof HYBRID_EVAL_IDS)[keyof typeof HYBRID_EVAL_IDS]
