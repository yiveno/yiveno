/**
 * 只读 MCP 工具契约（§5.10.5 · Normative 旁挂）。
 * 响应形态 = detail export 条目列表；禁止写操作 / 全库 dump。
 */

import { z } from 'zod'

import { DetailExportItemSchema, type DetailExportItem } from '@/core/recall/detail-export'

export const McpRecallEvidenceArgsSchema = z.object({
  /** 口语线索 */
  clue: z.string().trim().min(1).max(500),
  /** 返回条数；默认 3，硬顶 5 */
  limit: z.number().int().min(1).max(5).optional()
})

/** MCP 响应：detail export 形态，允许 1–5（单次 clue 可仅 Top1）。 */
export const McpDetailExportSchema = z.object({
  version: z.literal(1),
  exportedAt: z.string().datetime(),
  items: z.array(DetailExportItemSchema).min(1).max(5)
})

export type McpDetailExport = z.infer<typeof McpDetailExportSchema>

export function buildMcpDetailExport(
  items: DetailExportItem[],
  exportedAt: string = new Date().toISOString()
): McpDetailExport {
  return McpDetailExportSchema.parse({
    version: 1,
    exportedAt,
    items: items.slice(0, 5)
  })
}
