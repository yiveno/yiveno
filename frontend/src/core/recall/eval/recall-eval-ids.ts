/**
 * Eval 记忆库固定 ID。
 * 用例通过这些 ID 断言期望命中，避免依赖随机 UUID。
 */
export const RECALL_EVAL_IDS = {
  yivenoProductDoc: '11111111-1111-4111-8111-111111111101',
  yivenoDesignPrinciples: '11111111-1111-4111-8111-111111111102',
  githubRepo: '11111111-1111-4111-8111-111111111103',
  retentionFramework: '11111111-1111-4111-8111-111111111104',
  cloudflareWorkersGuide: '11111111-1111-4111-8111-111111111105',
  vectorIndexExcerpt: '11111111-1111-4111-8111-111111111106',
  deployChecklistExcerpt: '11111111-1111-4111-8111-111111111107',
  cookingRecipeNoise: '11111111-1111-4111-8111-111111111108',
  chromeExtensionMv3: '11111111-1111-4111-8111-111111111109',
  weeklyReviewNote: '11111111-1111-4111-8111-111111111110',
  /** 仅上下文含「红白」，主文不含 */
  hongbaiContextOnly: '11111111-1111-4111-8111-111111111111',
  /** 主文含线索，但非起首、密度较低 */
  excerptMatchEmbedded: '11111111-1111-4111-8111-111111111112',
  /** 主文起首含线索，且更短密 */
  excerptMatchPrefixTight: '11111111-1111-4111-8111-111111111113',
  /** 英文：夹心匹配 */
  excerptMatchEmbeddedEn: '11111111-1111-4111-8111-111111111114',
  /** 英文：起首+更短密 */
  excerptMatchPrefixTightEn: '11111111-1111-4111-8111-111111111115',
  /** Type B：正文泛化，靠 clues.note 找回 */
  typeBRetentionNote: '11111111-1111-4111-8111-111111111116'
} as const

export type RecallEvalItemId = (typeof RECALL_EVAL_IDS)[keyof typeof RECALL_EVAL_IDS]
