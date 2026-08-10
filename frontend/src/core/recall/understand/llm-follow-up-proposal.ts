/**
 * LLM 追问 NLG 提议（Zod）。
 * 模型只提议文案与芯片；门禁映射后再给 UI；不碰数据平面。
 */

import { z } from 'zod'

/** 单枚追问芯片提议。 */
export const LlmFollowUpChipProposalSchema = z.object({
  /** 展示文案（与用户线索同语言） */
  label: z.string().min(1).max(48),
  /**
   * 点击后作为本轮 clue 发送的稳定英文值（供跨语言 parse）。
   * 例：yesterday / last week / from this site
   */
  value: z.string().min(1).max(80)
})

/**
 * LLM 追问完整提议。
 * - reply：助手下一句（同用户语言；谈记忆库，不谈现实生活）
 * - chips：0–5 枚；可为空（仅文案）
 */
export const LlmFollowUpProposalSchema = z.object({
  reply: z.string().min(1).max(320),
  chips: z.array(LlmFollowUpChipProposalSchema).max(5).default([])
})

export type LlmFollowUpChipProposal = z.infer<typeof LlmFollowUpChipProposalSchema>
export type LlmFollowUpProposal = z.infer<typeof LlmFollowUpProposalSchema>
