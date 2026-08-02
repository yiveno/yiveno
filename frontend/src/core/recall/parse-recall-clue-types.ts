import { z } from 'zod'

/**
 * P0 可识别的对象类型（与 enrichment tags 对齐用英文 slug）。
 * - poem：诗
 * - article：文章
 * - song：歌曲
 * - video：视频
 * - code：代码
 * - command：命令
 * - page：页面
 * - password：密码
 * - quote：引文
 */
export const RecallObjectTypeSchema = z.enum([
  'poem', // 诗
  'article', // 文章
  'song', // 歌曲
  'video', // 视频
  'code', // 代码
  'command', // 命令
  'page', // 页面
  'password', // 密码
  'quote' // 引文
])

export type RecallObjectType = z.infer<typeof RecallObjectTypeSchema>

/**
 * P0 弱行为提示（无精确阅读进度时仅作加权/追问信号）。
 * - half_read：看了一半 / 未读完
 * - often_opened：常打开 / 反复听
 * - recently_saved：刚保存
 */
export const RecallBehaviorHintSchema = z.enum([
  'half_read', // 未读完
  'often_opened', // 常打开
  'recently_saved' // 刚保存
])

export type RecallBehaviorHint = z.infer<typeof RecallBehaviorHintSchema>

/**
 * 解析置信度：供编排层决定直给 / 候选 / 追问。
 * - high：多槽位齐全
 * - medium：部分约束
 * - low：仅弱信号
 */
export const RecallClueConfidenceSchema = z.enum([
  'high', // 高
  'medium', // 中
  'low' // 低
])

export type RecallClueConfidence = z.infer<typeof RecallClueConfidenceSchema>

/** 相对时间窗（ISO 8601），闭区间 [from, to]。 */
export const RecallTimeRangeSchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  /** 命中的相对时间标签，便于调试与追问模板。 */
  label: z.string().min(1)
})

export type RecallTimeRange = z.infer<typeof RecallTimeRangeSchema>

/**
 * 口语线索解析结果（P0）。
 * 由 orchestrate-keyword-recall / KeywordRecallBackend 消费。
 */
export const ParsedRecallClueSchema = z.object({
  raw: z.string(),
  timeRange: RecallTimeRangeSchema.optional(),
  objectTypes: z.array(RecallObjectTypeSchema).optional(),
  behaviorHints: z.array(RecallBehaviorHintSchema).optional(),
  noteHint: z.boolean().optional(),
  /** 剥掉时间/类型/行为/备注词与填充词后的检索词。 */
  contentTerms: z.array(z.string()),
  confidence: RecallClueConfidenceSchema
})

export type ParsedRecallClue = z.infer<typeof ParsedRecallClueSchema>
