import { z } from 'zod'

/** 列表级邻域说明：检索路径（闭集）。 */
export const RecallFramingRetrievalPathSchema = z.enum([
  'literal', // 字面 / 字段命中为主
  'constraint_neighborhood', // 类型/时间邻域为主
  'hybrid', // 语义 / RRF 参与
  'mixed' // 邻域与字面/语义混合
])

export type RecallFramingRetrievalPath = z.infer<typeof RecallFramingRetrievalPathSchema>

/** 把握度（闭集）。 */
export const RecallFramingStanceSchema = z.enum([
  'confident_neighborhood', // top_pick
  'weak_candidates' // need_a_clue
])

/** 分桶 id 闭集：excerpt · bookmark · with_note · constraint_neighborhood · 或 `domain:host`。 */

export const RecallFramingBucketSchema = z.object({
  /** 闭集桶 id 或 `domain:example.com`。 */
  id: z.string().min(1),
  /** i18n label key（domain 桶用 framing_bucket_domain + host 占位）。 */
  labelKey: z.string().min(1),
  count: z.number().int().positive(),
  /** domain 桶专用展示 host。 */
  domain: z.string().optional()
})

export type RecallFramingBucket = z.infer<typeof RecallFramingBucketSchema>

export const RecallFramingAmbiguitySchema = z.object({
  kind: z.enum([
    'site', // 按站点澄清
    'note', // 按附注澄清
    'token', // 按内容词澄清
    'type_mix' // 按类型混桶澄清
  ]),
  /** 静态澄清句 i18n key。 */
  promptKey: z.string().min(1),
  /** type_mix 时对象类型 slug（如 video）。 */
  objectType: z.string().optional()
})

export type RecallFramingAmbiguity = z.infer<typeof RecallFramingAmbiguitySchema>

export const RecallFramingUnderstoodSchema = z.object({
  objectTypes: z.array(z.string()),
  timeLabel: z.string().optional(),
  /** high=Within；low=Around（ADR-011） */
  timeConfidence: z
    .enum([
      'high', // 时间硬筛
      'low' // 时间软排
    ])
    .optional(),
  contentTerms: z.array(z.string()),
  behaviorHints: z.array(z.string()),
  noteHint: z.boolean(),
  /**
   * Topic 独立表述（Gap 2 · Framing Topic 独立表述）。
   * 仅当 parsed.topic 存在时出现；在 contentTerms 之外另列。
   * 语义角色：Topic 是「找什么的」根节点，与 contentTerms（「基于什么线索」）不同。
   */
  topicTerms: z.array(z.string()).optional()
})

export type RecallFramingUnderstood = z.infer<typeof RecallFramingUnderstoodSchema>

export const RecallFramingCountsSchema = z.object({
  total: z.number().int().nonnegative(),
  shown: z.number().int().nonnegative()
})

/** 候选列表 framing（top_pick / need_a_clue）。 */
export const RecallFramingCandidateFactsSchema = z.object({
  kind: z.literal('candidates'),
  understood: RecallFramingUnderstoodSchema,
  retrievalPath: RecallFramingRetrievalPathSchema,
  buckets: z.array(RecallFramingBucketSchema),
  stance: RecallFramingStanceSchema,
  ambiguity: RecallFramingAmbiguitySchema.optional(),
  counts: RecallFramingCountsSchema,
  isWideNeighborhood: z.boolean()
})

export type RecallFramingCandidateFacts = z.infer<typeof RecallFramingCandidateFactsSchema>

/** no_match + relatedGuess framing。 */
export const RecallFramingGuessFactsSchema = z.object({
  kind: z.literal('guess'),
  understood: RecallFramingUnderstoodSchema,
  emptyKind: z
    .enum([
      'constrained_none', // 强约束下库空
      'unconstrained' // 模糊空
    ])
    .optional()
})

/** no_match · 缺主题（H-topic）：未检索，只问一问。 */
export const RecallFramingMissingTopicFactsSchema = z.object({
  kind: z.literal('missing_topic')
})

export const RecallFramingFactsSchema = z.discriminatedUnion('kind', [
  RecallFramingCandidateFactsSchema,
  RecallFramingGuessFactsSchema,
  RecallFramingMissingTopicFactsSchema
])

export type RecallFramingFacts = z.infer<typeof RecallFramingFactsSchema>
