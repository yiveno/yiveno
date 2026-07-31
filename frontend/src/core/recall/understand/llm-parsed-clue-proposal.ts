import { z } from 'zod'

import {
  RecallBehaviorHintSchema,
  RecallClueConfidenceSchema,
  RecallObjectTypeSchema
} from '@/core/recall/parse-recall-clue-types'

/** 与词典 canonical 一致的时间标签（LLM 只许输出这些）。 */
export const RecallRelativeTimeLabelSchema = z.enum([
  'today',
  'yesterday',
  'day_before_yesterday',
  'last_week',
  'recent',
  'a_while_ago',
  'long_ago'
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
