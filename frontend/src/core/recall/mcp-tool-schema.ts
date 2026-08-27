/**
 * 只读 MCP 工具契约（§5.10.5 · Normative 旁挂）。
 * 响应形态 = evidence pack；禁止写操作 / 全库 dump。
 */

import { z } from 'zod'

import { EvidencePackItemSchema, type EvidencePackItem } from '@/core/recall/evidence-pack'

/** MCP 工具名（闭集）。 */
export const MCP_TOOL_RECALL_EVIDENCE = 'yiveno_recall_evidence' as const

export const McpRecallEvidenceArgsSchema = z.object({
  /** 口语线索 */
  clue: z.string().trim().min(1).max(500),
  /** 返回条数；默认 3，硬顶 5 */
  limit: z.number().int().min(1).max(5).optional()
})

export type McpRecallEvidenceArgs = z.infer<typeof McpRecallEvidenceArgsSchema>

/** MCP 响应：evidence pack 形态，允许 1–5（单次 query 可仅 Top1）。 */
export const McpEvidencePackSchema = z.object({
  version: z.literal(1),
  exportedAt: z.string().datetime(),
  items: z.array(EvidencePackItemSchema).min(1).max(5)
})

export type McpEvidencePack = z.infer<typeof McpEvidencePackSchema>

export const McpToolDescriptorSchema = z.object({
  name: z.literal(MCP_TOOL_RECALL_EVIDENCE),
  description: z.string(),
  inputSchema: z.record(z.string(), z.unknown())
})

export const McpRecallEvidenceResultSchema = z.object({
  ok: z.literal(true),
  pack: McpEvidencePackSchema,
  /** 本机 Hybrid / 云端关键词等 */
  backend: z.enum(['local_hybrid', 'cloud_keyword'])
})

export type McpRecallEvidenceResult = z.infer<typeof McpRecallEvidenceResultSchema>

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

/** Cursor / Claude 等客户端可复制的工具描述。 */
export function listMcpToolDescriptors(): z.infer<typeof McpToolDescriptorSchema>[] {
  return [
    {
      name: MCP_TOOL_RECALL_EVIDENCE,
      description:
        'Recall personal traces from the user Yiveno library as a scoped evidence pack (1–5 items). Read-only. Never dumps the full library.',
      inputSchema: {
        type: 'object',
        properties: {
          clue: { type: 'string', description: 'Natural-language clue' },
          limit: { type: 'integer', minimum: 1, maximum: 5 }
        },
        required: ['clue']
      }
    }
  ]
}
