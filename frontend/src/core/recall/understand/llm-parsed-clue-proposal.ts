import { z } from 'zod'

import {
  RecallBehaviorHintSchema,
  RecallClueConfidenceSchema,
  RecallObjectTypeSchema
} from '@/core/recall/parse-recall-clue-types'

/**
 * 与词典 canonical 一致的时间标签（LLM 只许输出这些）。
 * - today：今天
 * - yesterday：昨天
 * - day_before_yesterday：前天
 * - last_week：上周
 * - recent：最近
 * - a_while_ago：前一阵（约数周）
 * - last_month：大约一个月前
 * - few_months_ago：几个月前
 * - long_ago：很久以前
 */
export const RecallRelativeTimeLabelSchema = z.enum([
  'today', // 今天
  'yesterday', // 昨天
  'day_before_yesterday', // 前天
  'last_week', // 上周
  'recent', // 最近
  'a_while_ago', // 前一阵（约数周）
  'last_month', // 大约一个月前
  'few_months_ago', // 几个月前
  'long_ago' // 很久以前
])

/**
 * LLM 理解层提议（非事实源）。
 * 不含绝对时间窗：由确定性代码用 nowMs + timeLabel 生成 timeRange。
 */
export const LlmParsedClueProposalSchema = z.object({
  timeLabel: RecallRelativeTimeLabelSchema.nullable().optional(),
  objectTypes: z.array(RecallObjectTypeSchema).nullable().optional(),
  behaviorHints: z.array(RecallBehaviorHintSchema).nullable().optional(),
  noteHint: z.boolean().optional(),
  contentTerms: z.array(z.string()),
  /** 仅作提示；map 时会按槽位重算 */
  confidence: RecallClueConfidenceSchema.optional().default('low')
})

export type LlmParsedClueProposal = z.infer<typeof LlmParsedClueProposalSchema>
