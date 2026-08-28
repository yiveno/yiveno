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
  kind: z.enum(['site', 'note', 'token', 'type_mix']),
  /** 静态澄清句 i18n key。 */
  promptKey: z.string().min(1),
  /** type_mix 时对象类型 slug（如 video）。 */
  objectType: z.string().optional()
})

export type RecallFramingAmbiguity = z.infer<typeof RecallFramingAmbiguitySchema>

export const RecallFramingUnderstoodSchema = z.object({
  objectTypes: z.array(z.string()),
  timeLabel: z.string().optional(),
  contentTerms: z.array(z.string()),
  behaviorHints: z.array(z.string()),
  noteHint: z.boolean()
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
  emptyKind: z.enum(['constrained_none', 'unconstrained']).optional()
})

export const RecallFramingFactsSchema = z.discriminatedUnion('kind', [
  RecallFramingCandidateFactsSchema,
  RecallFramingGuessFactsSchema
])

export type RecallFramingFacts = z.infer<typeof RecallFramingFactsSchema>
