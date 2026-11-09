import { z } from 'zod'

import {
  RecallBehaviorHintSchema,
  RecallClueConfidenceSchema,
  RecallClueIntentSchema,
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
  /** 相对时间标签；null = 明确无时间；缺省 = 模型未填；越枚举 → 置空（保留其余字段） */
  timeLabel: RecallRelativeTimeLabelSchema.nullable().optional().catch(undefined),
  /** 对象类型；null = 明确无类型；缺省 = 未填；数组含坏元素 → 整字段置空 */
  objectTypes: z.array(RecallObjectTypeSchema).nullable().optional().catch(undefined),
  /** 行为提示；null = 明确无；缺省 = 未填；数组含坏元素 → 整字段置空 */
  behaviorHints: z.array(RecallBehaviorHintSchema).nullable().optional().catch(undefined),
  /** true = 指向附注；非布尔 → 置空 */
  noteHint: z.boolean().optional().catch(undefined),
  /** 内容检索词（模型提议；经 map 再落地）；畸形仍整单抛错，走规则降级 */
  contentTerms: z.array(z.string()),
  /**
   * 用户明确要求排除的内容词（与 contentTerms 互斥）。
   * null/缺省 = 无线索内排除；禁止把 not sure / don't remember 等不确定表达写入本槽。
   * 畸形仍整单抛错（与 contentTerms 同：规则从原文重提更好）。
   */
  excludeContentTerms: z.array(z.string()).nullable().optional(),
  /**
   * 用户意图；缺省 = recall；不确定时模型必须选 recall。
   * recall = 找东西；chitchat = 闲聊；question = 事实问题；instruction = 指令/生成/提醒/删除。
   * （本字段不进检索，只供后端短路判断。）
   * 越枚举 → 回落 recall，避免整单作废丢掉 intent。
   */
  intent: RecallClueIntentSchema.optional().default('recall').catch('recall'),
  /**
   * intent=chitchat|question|instruction 时的自然回复（与 clue 同语言，短 + 往 recall 引）。
   * recall 时必须为空。
   * 长度由 map 层截断（不靠 schema max，避免整单解析失败）。
   * 非字符串仍整单抛错：丢掉 reply 会让非召回短路缺回复、误入检索。
   */
  assistantReply: z.string().nullable().optional(),
  /** 仅作提示；map 时会按槽位重算；越枚举 → 回落 low */
  confidence: RecallClueConfidenceSchema.optional().default('low').catch('low')
})

/** schema.parse 之后的提案（含 default 填充）。 */
export type LlmParsedClueProposal = z.infer<typeof LlmParsedClueProposalSchema>
/** 传入 map / 测试字面量用的输入形（intent 等可缺省）。 */
export type LlmParsedClueProposalInput = z.input<typeof LlmParsedClueProposalSchema>
