/**
 * 只读 MCP 工具契约（§5.10.5 · Normative 旁挂）。
 * 响应形态 = evidence pack；禁止写操作 / 全库 dump。
 */

import { z } from 'zod'

import { EvidencePackItemSchema, type EvidencePackItem } from '@/core/recall/evidence-pack'

export const McpRecallEvidenceArgsSchema = z.object({
  /** 口语线索 */
  clue: z.string().trim().min(1).max(500),
  /** 返回条数；默认 3，硬顶 5 */
  limit: z.number().int().min(1).max(5).optional()
})

/** MCP 响应：evidence pack 形态，允许 1–5（单次 query 可仅 Top1）。 */
export const McpEvidencePackSchema = z.object({
  version: z.literal(1),
  exportedAt: z.string().datetime(),
  items: z.array(EvidencePackItemSchema).min(1).max(5)
})

export type McpEvidencePack = z.infer<typeof McpEvidencePackSchema>

export function buildMcpEvidencePack(
  items: EvidencePackItem[],
  exportedAt: string = new Date().toISOString()
): McpEvidencePack {
  return McpEvidencePackSchema.parse({
    version: 1,
    exportedAt,
    items: items.slice(0, 5)
  })
}
