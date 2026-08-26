/**
 * LLM 润色 Narrow 举例词的 Zod 提议。
 * 模型只改展示形态；门禁保证与已选定词同一 identity，禁止造词。
 */

import { z } from 'zod'

/**
 * 润色提议：examples 与输入选定词一一对应、等长。
 */
export const LlmNarrowExamplePolishProposalSchema = z.object({
  /** 润色后的展示串（美式英语字面；须与选定词同 token identity） */
  examples: z.array(z.string().min(1).max(64)).min(1).max(3)
})

export type LlmNarrowExamplePolishProposal = z.infer<typeof LlmNarrowExamplePolishProposalSchema>
