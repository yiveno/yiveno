/**
 * L2 召回消融 corpus 稳定 ID（`3333...` 前缀）。
 * 与 recall-eval（1111）/ hybrid-eval（2222）隔离，避免断言串库。
 */

export const RETRIEVAL_ABLATION_IDS = {
  /** 词面弱、语义应近：曼哈顿计划电影评论摘录 */
  semanticMovieExcerpt: '33333333-3333-4333-8333-333333333301',
  /** 词面强：atomic bomb documentary 书签/页 */
  keywordLeaderPage: '33333333-3333-4333-8333-333333333302',
  /** 纯语义：物理学家/链式反应影评附注向 */
  pureSemanticPhysicistsNote: '33333333-3333-4333-8333-333333333303',
  /** 时窗内隐私文章 */
  privacyRecentExcerpt: '33333333-3333-4333-8333-333333333304',
  /** 窗外古老无关 */
  ancientBurialExcerpt: '33333333-3333-4333-8333-333333333305',
  /** 窗内但主题正交（天气） */
  weatherInWindowExcerpt: '33333333-3333-4333-8333-333333333306',
  /** 词面噪音：weekly review 小品 */
  weeklyReviewNoise: '33333333-3333-4333-8333-333333333307',
  /** 应 miss：与 clue 无关的食谱 */
  unrelatedRecipeExcerpt: '33333333-3333-4333-8333-333333333308',
  /** Cookie / consent 法务摘录（与核武/电影零词面） */
  cookieConsentLegalExcerpt: '33333333-3333-4333-8333-333333333309',
  /** 强干扰：核不扩散政策简报（含 nuclear，无影评/演员） */
  nuclearPolicyBriefExcerpt: '33333333-3333-4333-8333-333333333310',
  /** Yellowstone 徒步清单（无匹配题对照；非「行程记忆」金标命中） */
  hikingYellowstoneExcerpt: '33333333-3333-4333-8333-333333333311',
  /** 酸种面包笔记（第二食物域干扰） */
  sourdoughStarterExcerpt: '33333333-3333-4333-8333-333333333312'
} as const

export type RetrievalAblationItemId =
  (typeof RETRIEVAL_ABLATION_IDS)[keyof typeof RETRIEVAL_ABLATION_IDS]
